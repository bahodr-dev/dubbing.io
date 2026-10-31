import { aiLimiter, pollingLimiter } from '../middleware/rateLimiter.js';
import { validateTranscript } from '../validators/projectValidator.js';
import { assertCinemaReady, cinemaCapabilities } from '../services/cinema.js';
import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { db, uploadsDir } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { transcribeAudio } from '../services/ai/transcription.js';
import { translateSegments, translateText } from '../services/ai/translation.js';
import { getRenderableVoiceIds, hasConfiguredTtsProvider, synthesizeSpeech } from '../services/ai/tts.js';
import { canCloneVoices } from '../services/ai/voiceCloning.js';
import { JobManager, minutesForDuration } from '../services/jobQueue.js';
import { getMediaDuration } from '../services/media/durationDetector.js';
import * as mediaRepository from '../repositories/mediaRepository.js';
import * as minuteUsageRepository from '../repositories/minuteUsageRepository.js';
import { validateSpeechCadence } from '../services/speechCadence.js';

export const dubbingRouter = Router();
const MAX_MEDIA_DURATION_SECONDS = Number.parseInt(process.env.MAX_MEDIA_DURATION_SECONDS || '900', 10);

function assertDurationAllowed(duration) {
  if (!Number.isFinite(duration) || duration <= 0) {
    const error = new Error('Could not determine media duration.');
    error.status = 422;
    error.code = 'MEDIA_DURATION_INVALID';
    throw error;
  }
  if (duration > MAX_MEDIA_DURATION_SECONDS) {
    const error = new Error(`Media is longer than the ${Math.floor(MAX_MEDIA_DURATION_SECONDS / 60)} minute beta limit.`);
    error.status = 422;
    error.code = 'MEDIA_DURATION_EXCEEDED';
    throw error;
  }
}

// Apply auth middleware to all dubbing routes
dubbingRouter.use(authenticateToken);
dubbingRouter.use((req, res, next) => {
  if (req.method === 'GET') return pollingLimiter(req, res, next);
  return aiLimiter(req, res, next);
});
dubbingRouter.use((req, res, next) => {
  const b = req.body || {};
  if (b.text !== undefined && (typeof b.text !== 'string' || b.text.length > 10000)) return res.status(400).json({ error: 'Use text up to 10000 characters.' });
  if (b.segments !== undefined && (!Array.isArray(b.segments) || b.segments.length > 100 || !validateTranscript(b.segments).valid)) return res.status(400).json({ error: 'Use at most 100 valid transcript segments.' });
  if (Array.isArray(b.segments) && b.segments.reduce((sum, s) => sum + (s.originalText || s.text || '').length, 0) > 10000) return res.status(400).json({ error: 'Translate at most 10000 source characters per request.' });
  if (req.path === '/generate' && (!Number.isFinite(b.duration ?? 30) || (b.duration ?? 30) <= 0 || b.duration > 300)) return res.status(400).json({ error: 'Generate duration must be between 0 and 300 seconds.' });
  next();
});

// Exposes only safe boolean capabilities; credentials and provider details
// remain server-side. The Studio uses it to prevent doomed render jobs.
dubbingRouter.get('/capabilities', (req, res) => {
  return res.json({
    canRenderFinalDub: hasConfiguredTtsProvider(),
    requiredForFinalRender: hasConfiguredTtsProvider() ? [] : ['OPENAI_API_KEY or ELEVENLABS_API_KEY'],
    renderableVoiceIds: getRenderableVoiceIds(),
    canCloneVoices: canCloneVoices(),
    cinema: cinemaCapabilities(req.user.id),
  });
});

/**
 * Helper to resolve media file path strictly for the authenticated user
 */
function resolveUserMediaFile(req, mediaId, mediaPath) {
  if (!mediaId && !mediaPath) return null;

  let targetId = mediaId;
  let targetFilename = null;

  if (!targetId && mediaPath) {
    if (typeof mediaPath === 'string' && mediaPath.startsWith('/api/media/')) {
      targetId = mediaPath.replace('/api/media/', '').split('/')[0];
    } else {
      targetFilename = path.basename(mediaPath);
    }
  }

  let media = null;
  if (targetId) {
    media = mediaRepository.findByIdAndUser(targetId, req.user.id);
  }
  if (!media && targetFilename) {
    media = mediaRepository.findByStoredFilenameAndUser(targetFilename, req.user.id);
  }

  if (!media) {
    return { error: 'Media not found or unauthorized.' };
  }

  const storageRoot = path.resolve(uploadsDir);
  const safeFilePath = path.resolve(storageRoot, media.stored_filename);

  if (!safeFilePath.startsWith(storageRoot + path.sep) && safeFilePath !== storageRoot) {
    return { error: 'Access denied.' };
  }

  if (!fs.existsSync(safeFilePath)) {
    return { error: 'Media file not found on disk.' };
  }

  return { media, filePath: safeFilePath };
}

// 1. ASYNCHRONOUS FULL DUBBING PIPELINE (Job Queue with Ownership Validation)
dubbingRouter.post('/process', async (req, res) => {
  try {
    const {
      projectId,
      mediaId,
      mediaPath,
      originalLanguage = 'en',
      targetLanguage = 'uz',
      voiceId = 'voice-farrux',
      autoCloneVoices = false,
      autoAssignSiteVoices = false,
      speechCadence,
      qualityMode = 'standard',
      glossary = {},
    } = req.body;

    assertCinemaReady(qualityMode, req.user.id);
    // Verify project ownership if projectId provided
    let ownedProject = null;
    if (projectId) {
      ownedProject = db.prepare('SELECT id, source_media_id, source_url FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user.id);
      if (!ownedProject) {
        return res.status(404).json({ error: 'Project not found or unauthorized.' });
      }
    }

    let fullFilePath = null;
    let validatedMediaId = null;
    const projectMediaId = ownedProject?.source_media_id ||
      (/^\/api\/media\/([a-zA-Z0-9_-]+)$/.exec(ownedProject?.source_url || '')?.[1] || null);
    const requestedMediaId = mediaId || projectMediaId;
    if (requestedMediaId || mediaPath) {
      const mediaResult = resolveUserMediaFile(req, requestedMediaId, mediaPath);
      if (mediaResult.error) {
        return res.status(404).json({ error: mediaResult.error });
      }
      fullFilePath = mediaResult.filePath;
      validatedMediaId = mediaResult.media ? mediaResult.media.id : null;
    }
    if (!fullFilePath) {
      return res.status(400).json({ error: 'Upload a source media file before starting the final dub render.' });
    }
    if (autoCloneVoices === true && validatedMediaId !== ownedProject?.source_media_id) {
      return res.status(400).json({ error: 'Automatic voice cloning requires the media attached to this project.' });
    }
    validateSpeechCadence(speechCadence);
    if (!hasConfiguredTtsProvider()) {
      return res.status(503).json({
        error: 'Final dubbing requires an OpenAI or ElevenLabs TTS API key. Configure OPENAI_API_KEY or ELEVENLABS_API_KEY and try again.',
        code: 'TTS_NOT_CONFIGURED',
      });
    }
    const authoritativeDuration = await getMediaDuration(fullFilePath);
    assertDurationAllowed(authoritativeDuration);
    if (qualityMode === 'cinema' && authoritativeDuration > 300) return res.status(422).json({ error: 'Use the Film workflow in Studio for long Cinema sources.', code: 'FILM_WORKFLOW_REQUIRED' });
    assertCinemaReady(qualityMode, req.user.id, authoritativeDuration);

    const job = JobManager.createJob({
      userId: req.user.id,
      projectId,
      mediaId: validatedMediaId,
      filePath: fullFilePath,
      originalLanguage,
      targetLanguage,
      voiceId,
      autoCloneVoices,
      autoAssignSiteVoices,
      speechCadence, qualityMode, glossary,
      duration: authoritativeDuration,
    });

    return res.status(202).json({
      jobId: job.id,
      status: job.status,
      reservedMinutes: job.reservedMinutes,
      minutesBalance: job.minutesBalance,
      message: 'Dubbing pipeline started in background.',
    });
  } catch (err) {
    console.error('Error starting dubbing process:', err);
    const status = Number.isInteger(err?.status) ? err.status : 500;
    return res.status(status).json({
      error: status < 500 ? err.message : 'Failed to start dubbing job.',
      code: err?.code,
      requiredMinutes: err?.requiredMinutes,
      minutesBalance: err?.minutesBalance,
    });
  }
});

// Regeneration uses a fresh immutable project snapshot and the same artifact cache.
dubbingRouter.post('/projects/:projectId/regenerate', async (req, res) => {
  try {
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.projectId, req.user.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    assertCinemaReady('cinema', req.user.id);
    if (project.quality_mode !== 'cinema') return res.status(409).json({ error: 'Create a Cinema dub before regenerating segments.' });
    const segments = JSON.parse(project.segments_json || '[]');
    const ids = req.body.segmentIds;
    if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== 'string' || !segments.some(s => s.id === id))) {
      return res.status(400).json({ error: 'Choose valid segmentIds from this project.' });
    }
    const latest = JobManager.getLatestProjectJob(project.id, req.user.id);
    const media = resolveUserMediaFile(req, project.source_media_id);
    if (media?.error || !media) return res.status(404).json({ error: 'Source media not found.' });
    const duration = await getMediaDuration(media.filePath);
    const job = JobManager.createJob({ userId: req.user.id, projectId: project.id,
      mediaId: project.source_media_id, filePath: media.filePath, duration,
      originalLanguage: project.original_language, targetLanguage: project.target_language,
      voiceId: project.voice_id, qualityMode: 'cinema', glossary: latest?.glossary || {}, segmentIds: [...new Set(ids)],
      autoCloneVoices: latest?.autoCloneVoices === true,
      filmMode: latest?.filmMode === true, budgetMicros: req.body.budgetMicros,
      speechCadence: req.body.speechCadence || latest?.speechCadence || 'natural',
    });
    return res.status(202).json({ jobId: job.id, status: job.status, reservedMinutes: job.reservedMinutes, minutesBalance: job.minutesBalance });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message, code: error.code });
  }
});

// 2. POLL JOB STATUS (Owner-isolated)
dubbingRouter.get('/jobs/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = JobManager.getJob(jobId, req.user.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found or unauthorized.' });
    }

    const segments = job.segments || (job.result && job.result.segments) || [];
    const responsePayload = {
      jobId: job.id || job.jobId,
      status: job.status,
      progress: job.progress || (job.status === 'completed' ? 100 : (job.status === 'processing' ? 50 : 10)),
      job,
      minutesBalance: Number(db.prepare('SELECT minutes_balance FROM users WHERE id = ?').get(req.user.id)?.minutes_balance || 0),
    };

    if (['completed', 'partial'].includes(job.status)) {
      responsePayload.result = job.result || {
        segments,
        segmentCount: segments.length,
        language: job.language || 'en',
        duration: job.duration || 0,
      };
    } else if (job.status === 'failed') {
      responsePayload.error = job.error || 'Operation failed.';
    }

    return res.json(responsePayload);
  } catch (err) {
    console.error('Error fetching job status:', err);
    return res.status(500).json({ error: 'Failed to fetch job status.' });
  }
});

dubbingRouter.get('/usage', (req, res) => {
  try {
    const user = db.prepare('SELECT minutes_balance FROM users WHERE id = ?').get(req.user.id);
    const usage = minuteUsageRepository.findRecentUsageByUser(req.user.id).map((entry) => ({
      id: entry.id,
      projectId: entry.project_id,
      jobId: entry.job_id,
      minutes: entry.minutes,
      status: entry.status,
      failureReason: entry.failure_reason,
      reservedAt: entry.reserved_at,
      consumedAt: entry.consumed_at,
      refundedAt: entry.refunded_at,
      updatedAt: entry.updated_at,
    }));
    return res.json({ minutesBalance: Number(user?.minutes_balance || 0), usage });
  } catch (err) {
    console.error('Error fetching minute usage:', err);
    return res.status(500).json({ error: 'Failed to fetch minute usage.' });
  }
});

// Check the owned source against the current balance before creating a project
// or starting a transcription. The final job still reserves minutes atomically.
dubbingRouter.post('/check-minutes', async (req, res) => {
  try {
    const mediaId = req.body?.mediaId;
    if (typeof mediaId !== 'string' || !mediaId) {
      return res.status(400).json({ error: 'A media ID is required.' });
    }
    const mediaResult = resolveUserMediaFile(req, mediaId);
    if (mediaResult.error) return res.status(404).json({ error: mediaResult.error });

    assertCinemaReady(req.body.qualityMode || 'standard', req.user.id);
    const duration = await getMediaDuration(mediaResult.filePath);
    assertCinemaReady(req.body.qualityMode || 'standard', req.user.id, duration);
    if (req.body.qualityMode !== 'cinema') assertDurationAllowed(duration);
    const requiredMinutes = minutesForDuration(duration, req.body.qualityMode === 'cinema' || req.body.autoCloneVoices === true ? 1.5 : 1);
    if (!requiredMinutes) return res.status(422).json({ error: 'Could not determine media duration.' });
    const user = db.prepare('SELECT minutes_balance FROM users WHERE id = ?').get(req.user.id);
    const minutesBalance = Number(user?.minutes_balance || 0);
    return res.json({
      canStart: minutesBalance + 0.000001 >= requiredMinutes,
      duration,
      requiredMinutes,
      minutesBalance,
    });
  } catch (err) {
    console.error('Error checking media minutes:', err);
    return res.status(err.status || 422).json({ error: err.message || 'Could not check the video duration.', code: err.code });
  }
});

// Restore polling after a browser refresh by resolving the latest persisted
// dubbing job for an owned project.
dubbingRouter.get('/projects/:projectId/jobs/latest', (req, res) => {
  try {
    const job = JobManager.getLatestProjectJob(req.params.projectId, req.user.id);
    if (!job) {
      return res.status(404).json({ error: 'No dubbing job was found for this project.' });
    }
    return res.json({ jobId: job.id, status: job.status, job });
  } catch (err) {
    console.error('Error fetching latest project dubbing job:', err);
    return res.status(500).json({ error: 'Failed to fetch the latest project dubbing job.' });
  }
});

// 2b. RETRY A FAILED DUBBING JOB (owner-only, capped attempts)
dubbingRouter.post('/jobs/:jobId/retry', (req, res) => {
  try {
    const existingJob = JobManager.getJob(req.params.jobId, req.user.id);
    if (!existingJob) {
      return res.status(404).json({ error: 'Job not found or unauthorized.' });
    }

    let filePath = null;
    if (existingJob.mediaId) {
      const mediaResult = resolveUserMediaFile(req, existingJob.mediaId, null);
      if (mediaResult.error) {
        return res.status(404).json({ error: mediaResult.error });
      }
      filePath = mediaResult.filePath;
    }

    const retry = JobManager.retryDubbingJob({
      jobId: req.params.jobId,
      userId: req.user.id,
      filePath,
    });
    if (retry.error) {
      const status = retry.code === 'INSUFFICIENT_MINUTES'
        ? 402
        : retry.error.includes('not found') ? 404 : 409;
      return res.status(status).json({
        error: retry.error,
        code: retry.code,
        requiredMinutes: retry.requiredMinutes,
        minutesBalance: retry.minutesBalance,
      });
    }

    return res.status(202).json({
      jobId: retry.job.id,
      status: retry.job.status,
      attempt: retry.job.attempt,
      maxAttempts: retry.job.maxAttempts,
      reservedMinutes: retry.reservedMinutes,
      minutesBalance: retry.minutesBalance,
      message: 'Dubbing job retry started in background.',
    });
  } catch (err) {
    console.error('Error retrying dubbing job:', err);
    return res.status(500).json({ error: 'Failed to retry dubbing job.' });
  }
});

// Alias for transcription specific polling
dubbingRouter.get('/transcribe/jobs/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const job = JobManager.getJob(jobId, req.user.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found or unauthorized.' });
    }

    const segments = job.segments || (job.result && job.result.segments) || [];
    const responsePayload = {
      jobId: job.id || job.jobId,
      status: job.status,
      progress: job.progress || (job.status === 'completed' ? 100 : (job.status === 'processing' ? 50 : 10)),
      job,
    };

    if (['completed', 'partial'].includes(job.status)) {
      responsePayload.result = {
        segments,
        segmentCount: segments.length,
        language: job.language || 'en',
        duration: job.duration || 0,
      };
    } else if (job.status === 'failed') {
      responsePayload.error = job.error || 'Transcription failed.';
    }

    return res.json(responsePayload);
  } catch (err) {
    console.error('Error fetching transcription job status:', err);
    return res.status(500).json({ error: 'Failed to fetch transcription job status.' });
  }
});

dubbingRouter.get('/transcribe/projects/:projectId/jobs/latest', (req, res) => {
  try {
    const job = JobManager.getLatestProjectTranscriptionJob(req.params.projectId, req.user.id);
    if (!job) {
      return res.status(404).json({ error: 'No transcription job was found for this project.' });
    }
    return res.json({ jobId: job.id, status: job.status, job });
  } catch (err) {
    console.error('Error fetching latest transcription job:', err);
    return res.status(500).json({ error: 'Failed to fetch the latest transcription job.' });
  }
});

dubbingRouter.post('/transcribe/jobs/:jobId/retry', (req, res) => {
  try {
    const existingJob = JobManager.getJob(req.params.jobId, req.user.id);
    if (!existingJob || existingJob.type !== 'transcription') {
      return res.status(404).json({ error: 'Transcription job not found or unauthorized.' });
    }

    let filePath = null;
    if (existingJob.mediaId) {
      const mediaResult = resolveUserMediaFile(req, existingJob.mediaId, null);
      if (mediaResult.error) return res.status(404).json({ error: mediaResult.error });
      filePath = mediaResult.filePath;
    }

    const retry = JobManager.retryTranscriptionJob({
      jobId: req.params.jobId,
      userId: req.user.id,
      filePath,
    });
    if (retry.error) {
      return res.status(retry.error.includes('not found') ? 404 : 409).json({ error: retry.error });
    }
    return res.status(202).json({
      jobId: retry.job.id,
      status: retry.job.status,
      attempt: retry.job.attempt,
      maxAttempts: retry.job.maxAttempts,
      message: 'Transcription retry started in background.',
    });
  } catch (err) {
    console.error('Error retrying transcription job:', err);
    return res.status(500).json({ error: 'Failed to retry transcription job.' });
  }
});

// 3. TRANSCRIBE (Fully Asynchronous ASR with Media & Project Ownership Check)
dubbingRouter.post('/transcribe', async (req, res) => {
  try {
    const {
      mediaId,
      mediaPath,
      projectId,
      duration,
      language = 'en',
      providerType = 'auto',
    } = req.body;

    const allowedProviders = new Set(['auto', 'openai', 'elevenlabs', 'mock']);
    if (!allowedProviders.has(providerType)) {
      return res.status(400).json({ error: 'Unsupported transcription provider.' });
    }
    if (providerType === 'mock' && process.env.NODE_ENV === 'production') {
      return res.status(400).json({ error: 'Mock transcription is not available in production.' });
    }

    // Verify project ownership if projectId provided
    if (projectId) {
      const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user.id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found or unauthorized.' });
      }
    }

    let fullFilePath = null;
    let validatedMediaId = null;
    if (mediaId || mediaPath) {
      const mediaResult = resolveUserMediaFile(req, mediaId, mediaPath);
      if (mediaResult.error) {
        return res.status(404).json({ error: mediaResult.error });
      }
      fullFilePath = mediaResult.filePath;
      validatedMediaId = mediaResult.media ? mediaResult.media.id : null;
    }

    const authoritativeDuration = fullFilePath ? await getMediaDuration(fullFilePath) : duration;
    if (fullFilePath) assertDurationAllowed(authoritativeDuration);

    // Always create an asynchronous background job - NEVER transcribe synchronously inside request
    const job = JobManager.createTranscriptionJob({
      userId: req.user.id,
      projectId,
      mediaId: validatedMediaId,
      filePath: fullFilePath,
      language,
      duration: authoritativeDuration,
      durationIsAuthoritative: Boolean(fullFilePath),
      providerType,
    });

    return res.status(202).json({
      jobId: job.id,
      status: job.status,
      message: 'Transcription job queued in background.',
    });
  } catch (err) {
    console.error('Error creating transcription job:', err);
    const status = Number.isInteger(err?.status) ? err.status : 500;
    return res.status(status).json({
      error: status < 500 ? err.message : 'Failed to create transcription job.',
      code: err?.code,
    });
  }
});

// 4. TRANSLATE
dubbingRouter.post('/translate', async (req, res) => {
  try {
    const { text, segments, sourceLanguage = 'en', targetLanguage = 'uz' } = req.body;

    if (segments && Array.isArray(segments)) {
      const translatedSegments = await translateSegments({
        segments,
        sourceLanguage,
        targetLanguage,
      });
      return res.json({ segments: translatedSegments });
    }

    if (text) {
      const translatedText = await translateText({
        text,
        sourceLanguage,
        targetLanguage,
      });
      return res.json({ originalText: text, translatedText, targetLanguage });
    }

    return res.status(400).json({ error: 'Provide text or segments to translate.' });
  } catch (err) {
    console.error('Error translating text:', err);
    return res.status(500).json({ error: 'Failed to translate content.' });
  }
});

// 5. TTS SYNTHESIS (Private Media Storage)
dubbingRouter.post('/synthesize', async (req, res) => {
  try {
    const { text, voiceId = 'voice-farrux', speed = 1.0 } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required for voice synthesis.' });
    }

    const result = await synthesizeSpeech({
      text,
      voiceId,
      speed,
      userId: req.user.id,
    });

    return res.json({
      audioUrl: result.audioUrl,
      duration: result.durationEstimate,
      provider: result.provider,
      message: 'Speech synthesized successfully!',
    });
  } catch (err) {
    console.error('Error synthesizing speech:', err);
    return res.status(500).json({ error: 'Failed to synthesize voice audio.' });
  }
});

// 6. GENERATE TRANSCRIPT TIMELINE (Synchronous generator)
dubbingRouter.post('/generate', async (req, res) => {
  try {
    const { targetLanguage = 'uz', duration = 30 } = req.body;
    const rawSegments = await transcribeAudio({ duration });
    const translatedSegments = await translateSegments({
      segments: rawSegments,
      sourceLanguage: 'en',
      targetLanguage,
    });

    return res.json({
      transcript: translatedSegments,
      targetLanguage,
      segmentCount: translatedSegments.length,
      message: 'AI Dubbing transcript generated successfully!',
    });
  } catch (err) {
    console.error('Error generating dubbing:', err);
    return res.status(500).json({ error: 'Failed to generate dubbing transcript.' });
  }
});

// Helper to format seconds to SRT timestamp: 00:00:00,000
function formatSrtTime(seconds) {
  const pad = (num, size) => ('000' + num).slice(-size);
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(ms, 3)}`;
}

// 7. EXPORT SUBTITLES (SRT, VTT, JSON - Authenticated & User-Isolated)
dubbingRouter.get('/export/:id/:format', (req, res) => {
  try {
    const { id, format } = req.params;
    const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, req.user.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    const segments = project.segments_json ? JSON.parse(project.segments_json) : [];
    const cleanTitle = (project.title || 'dubbing-export').replace(/[^a-zA-Z0-9-_]/g, '_');

    if (format === 'srt') {
      let srtContent = '';
      segments.forEach((seg, index) => {
        srtContent += `${index + 1}\n`;
        srtContent += `${formatSrtTime(seg.startTime || 0)} --> ${formatSrtTime(seg.endTime || 0)}\n`;
        srtContent += `${seg.translatedText || seg.originalText}\n\n`;
      });

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.srt"`);
      return res.send(srtContent);
    }

    if (format === 'vtt') {
      let vttContent = 'WEBVTT\n\n';
      segments.forEach((seg, index) => {
        const start = formatSrtTime(seg.startTime || 0).replace(',', '.');
        const end = formatSrtTime(seg.endTime || 0).replace(',', '.');
        vttContent += `${index + 1}\n${start} --> ${end}\n${seg.translatedText || seg.originalText}\n\n`;
      });

      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.vtt"`);
      return res.send(vttContent);
    }

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.json"`);
      return res.json({ project, segments });
    }

    return res.status(400).json({ error: 'Unsupported format. Use srt, vtt, or json.' });
  } catch (err) {
    console.error('Error exporting subtitles:', err);
    return res.status(500).json({ error: 'Failed to export subtitles.' });
  }
});
