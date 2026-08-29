import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { db, uploadsDir } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { transcribeAudio } from '../services/ai/transcription.js';
import { translateSegments, translateText } from '../services/ai/translation.js';
import { synthesizeSpeech } from '../services/ai/tts.js';
import { JobManager } from '../services/jobQueue.js';
import * as mediaRepository from '../repositories/mediaRepository.js';

export const dubbingRouter = Router();

// Apply auth middleware to all dubbing routes
dubbingRouter.use(authenticateToken);

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
dubbingRouter.post('/process', (req, res) => {
  try {
    const {
      projectId,
      mediaId,
      mediaPath,
      originalLanguage = 'en',
      targetLanguage = 'uz',
      voiceId = 'voice-farrux',
      duration = 30,
    } = req.body;

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

    const job = JobManager.createJob({
      userId: req.user.id,
      projectId,
      mediaId: validatedMediaId,
      filePath: fullFilePath,
      originalLanguage,
      targetLanguage,
      voiceId,
      duration,
    });

    return res.status(202).json({
      jobId: job.id,
      status: job.status,
      message: 'Dubbing pipeline started in background.',
    });
  } catch (err) {
    console.error('Error starting dubbing process:', err);
    return res.status(500).json({ error: 'Failed to start dubbing job.' });
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

    return res.json({ job });
  } catch (err) {
    console.error('Error fetching job status:', err);
    return res.status(500).json({ error: 'Failed to fetch job status.' });
  }
});

// 3. TRANSCRIBE (ASR with Media Ownership Check)
dubbingRouter.post('/transcribe', async (req, res) => {
  try {
    const { mediaId, mediaPath, duration = 30, language = 'en' } = req.body;

    let fullFilePath = null;
    if (mediaId || mediaPath) {
      const mediaResult = resolveUserMediaFile(req, mediaId, mediaPath);
      if (mediaResult.error) {
        return res.status(404).json({ error: mediaResult.error });
      }
      fullFilePath = mediaResult.filePath;
    }

    const segments = await transcribeAudio({
      filePath: fullFilePath,
      duration,
      language,
    });

    return res.json({
      segments,
      segmentCount: segments.length,
      message: 'Audio transcribed successfully!',
    });
  } catch (err) {
    console.error('Error transcribing audio:', err);
    return res.status(500).json({ error: 'Failed to transcribe audio.' });
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
