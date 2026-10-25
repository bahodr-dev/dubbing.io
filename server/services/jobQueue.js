import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { transcribeAudio } from './ai/transcription.js';
import { translateSegments } from './ai/translation.js';
import { isRenderableVoiceId, synthesizeSpeech } from './ai/tts.js';
import { getMediaDuration } from './media/durationDetector.js';
import { renderDubbedMedia } from './media/dubbingRenderer.js';
import { cleanupTempFile } from './media/audioExtractor.js';
import { canCloneVoices, cloneJobSpeakers, cleanupJobVoiceClones, cleanupTerminalVoiceClones, verifyProjectDiarization } from './ai/voiceCloning.js';
import { planSpeakerSamples } from './media/speakerSampleExtractor.js';
import { db, uploadsDir } from '../db.js';
import * as transcriptionRepo from '../repositories/transcriptionRepository.js';
import * as dubbingJobRepo from '../repositories/dubbingJobRepository.js';
import * as mediaRepository from '../repositories/mediaRepository.js';
import * as minuteUsageRepository from '../repositories/minuteUsageRepository.js';
import { logEvent } from './logger.js';
import { validateProjectPayload, validateTranscript } from '../validators/projectValidator.js';

function sanitizeError(err) {
  if (!err) return 'Transcription failed';
  const raw = typeof err === 'string' ? err : (err.message || 'Transcription failed');
  let sanitized = raw.replace(/(\/[a-zA-Z0-9_.-]+)+/g, '[path]');
  sanitized = sanitized.replace(/sk-[a-zA-Z0-9_-]{10,}/g, '[redacted_key]');
  return sanitized.split('\n')[0].trim() || 'Transcription failed';
}

// In-memory store for fast polling with DB sync
const jobs = new Map();
const LEASED_JOB_STATUSES = new Set(['queued', 'transcribing', 'translating', 'synthesizing', 'rendering']);
const TRANSCRIPTION_ACTIVE_STATUSES = new Set(['queued', 'processing']);
const WORKER_ID = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const JOB_LEASE_MS = Math.max(60_000, readPositiveInteger(process.env.JOB_LEASE_MS, 120_000));
const WORKER_POLL_MS = Math.max(5_000, readPositiveInteger(process.env.JOB_WORKER_POLL_MS, 15_000));
const ARTIFACT_RETENTION_MS = Math.max(
  60 * 60 * 1000,
  readPositiveInteger(process.env.JOB_ARTIFACT_RETENTION_HOURS, 24) * 60 * 60 * 1000,
);
let workerPollTimer = null;
let artifactCleanupTimer = null;

function persistDubbingJob(job, updates = {}) {
  const updated = dubbingJobRepo.updateDubbingJob(job.id, {
    status: job.status,
    progress: job.progress,
    currentStage: job.currentStage,
    error: job.error ?? null,
    attempt: job.attempt,
    params: { ...(job.params || {}), duration: job.duration ?? null },
    result: updates.result ?? job.result,
    ...(job.workerId ? { workerId: job.workerId } : {}),
  });
  if (!updated) return false;
  return job.workerId && LEASED_JOB_STATUSES.has(job.status)
    ? dubbingJobRepo.heartbeatDubbingJob(job.id, job.workerId, JOB_LEASE_MS)
    : true;
}

function resolveStoredMediaPath(mediaId, userId) {
  const media = mediaRepository.findByIdAndUser(mediaId, userId);
  if (!media) return null;
  const storageRoot = path.resolve(uploadsDir);
  const filePath = path.resolve(storageRoot, media.stored_filename || '');
  if (!filePath.startsWith(`${storageRoot}${path.sep}`) || !fs.existsSync(filePath)) return null;
  return filePath;
}

export function minutesForDuration(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  return Math.round((Math.ceil(durationSeconds) / 60) * 1_000_000) / 1_000_000;
}

export function resolveSegmentVoiceId(segment, { voiceId, speakerVoices } = {}) {
  const speaker = segment?.speaker;
  const assignedVoice = speaker && speakerVoices && Object.hasOwn(speakerVoices, speaker)
    ? speakerVoices[speaker]
    : null;
  return typeof assignedVoice === 'string' && assignedVoice.trim() ? assignedVoice : voiceId;
}

function insufficientMinutesError(requiredMinutes, balance) {
  const error = new Error(
    `Insufficient minutes. This dub requires ${requiredMinutes.toFixed(2)} minutes, but your balance is ${Number(balance || 0).toFixed(2)} minutes.`,
  );
  error.status = 402;
  error.code = 'INSUFFICIENT_MINUTES';
  error.requiredMinutes = requiredMinutes;
  error.minutesBalance = Number(balance || 0);
  return error;
}

async function synthesizeWithRetry(options, maxAttempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await synthesizeSpeech(options);
      if (!result.filePath) throw new Error('Speech provider did not return an audio file.');
      return result;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** (attempt - 1))));
    }
  }
  throw lastError;
}

export class JobManager {
  /**
   * Creates a dedicated asynchronous transcription job
   */
  static createTranscriptionJob({
    userId,
    projectId = null,
    mediaId = null,
    filePath = null,
    language = 'en',
    duration = null,
    durationIsAuthoritative = false,
    providerType = 'auto',
  } = {}) {
    const id = `txjob-${Date.now()}-${randomUUID().slice(0, 8)}`;

    // For real media, duration is NOT known until probed in background pipeline -> initial duration is null
    // For mock / test runs without real media (!filePath && !mediaId), explicit duration is respected or fallback to 30
    const isRealMedia = Boolean(filePath || mediaId);
    const initialDuration = isRealMedia && !durationIsAuthoritative
      ? null
      : (typeof duration === 'number' && duration > 0 ? duration : 30);

    const job = {
      id,
      jobId: id,
      type: 'transcription',
      userId,
      projectId,
      mediaId,
      status: 'queued',
      progress: 10,
      currentStage: 'Queued for transcription...',
      language,
      providerType,
      duration: initialDuration,
      attempt: 1,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createPersistedJob = db.transaction(() => {
      const activeJob = transcriptionRepo.findActiveJobForSource(userId, projectId, mediaId);
      if (activeJob) {
        const error = new Error('This source already has an active transcription job.');
        error.status = 409;
        error.code = 'TRANSCRIPTION_JOB_ALREADY_ACTIVE';
        throw error;
      }
      transcriptionRepo.createTranscriptionJob({
        id,
        userId,
        projectId,
        mediaId,
        status: job.status,
        progress: job.progress,
        currentStage: job.currentStage,
        language,
        providerType,
        duration: initialDuration,
        attempt: job.attempt,
        maxAttempts: job.maxAttempts,
      });
    });
    createPersistedJob.immediate();
    jobs.set(id, job);
    logEvent('transcription_job_started', { jobId: id, userId, projectId, mediaId, language });

    this.dispatchTranscriptionJob(id, filePath);

    return job;
  }

  /**
   * Runs the transcription-only pipeline
   */
  static async runTranscriptionPipeline(job, { filePath, language, duration, providerType }) {
    const id = job.id;
    const heartbeatTimer = setInterval(() => {
      try {
        transcriptionRepo.heartbeatTranscriptionJob(id, job.workerId, JOB_LEASE_MS);
      } catch (error) {
        logEvent('transcription_job_heartbeat_error', { jobId: id, error: sanitizeError(error) });
      }
    }, Math.max(15_000, Math.floor(JOB_LEASE_MS / 3)));
    heartbeatTimer.unref?.();
    try {
      job.status = 'processing';
      job.currentStage = 'Extracting audio with FFmpeg & transcribing with neural model...';
      job.progress = 40;
      job.updatedAt = new Date().toISOString();
      if (!transcriptionRepo.updateJobStatus(id, 'processing', {
        progress: job.progress,
        currentStage: job.currentStage,
        workerId: job.workerId,
      })) throw new Error('Transcription worker lease was lost.');
      if (!transcriptionRepo.heartbeatTranscriptionJob(id, job.workerId, JOB_LEASE_MS)) {
        throw new Error('Transcription worker lease was lost.');
      }

      // Real media duration detection (server source of truth)
      let actualDuration = null;
      if (filePath) {
        actualDuration = (typeof duration === 'number' && duration > 0)
          ? duration
          : await getMediaDuration(filePath);
        job.duration = actualDuration;
      } else {
        actualDuration = (typeof duration === 'number' && duration > 0) ? duration : 30;
        job.duration = actualDuration;
      }
      if (!transcriptionRepo.updateJobStatus(id, 'processing', {
        duration: actualDuration,
        progress: 55,
        currentStage: job.currentStage,
        workerId: job.workerId,
      })) throw new Error('Transcription worker lease was lost.');

      const segments = await transcribeAudio({
        filePath,
        duration: actualDuration,
        language,
        providerType,
        jobId: id,
      });

      const finalDuration = (segments && typeof segments.duration === 'number') ? segments.duration : actualDuration;
      job.duration = finalDuration;

      job.progress = 90;
      job.currentStage = 'Normalizing and persisting dialogue segments...';
      job.updatedAt = new Date().toISOString();
      if (!transcriptionRepo.updateJobStatus(id, 'processing', {
        duration: finalDuration,
        progress: job.progress,
        currentStage: job.currentStage,
        workerId: job.workerId,
      })) throw new Error('Transcription worker lease was lost.');

      // Save segments to database
      transcriptionRepo.saveTranscriptSegments(id, job.projectId, segments);

      // If tied to a project, also update the project's segments_json and duration
      if (job.projectId) {
        try {
          db.prepare(`
            UPDATE projects
            SET segments_json = ?, duration = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
          `).run(JSON.stringify(segments), finalDuration, job.projectId, job.userId);
        } catch (dbErr) {
          console.warn('[JobManager] Could not update project segments_json:', dbErr);
        }
      }

      job.status = 'completed';
      job.currentStage = 'Transcription completed successfully!';
      job.progress = 100;
      job.result = {
        segments,
        segmentCount: segments.length,
        language,
        duration: finalDuration,
      };
      job.segments = segments;
      job.updatedAt = new Date().toISOString();

      if (!transcriptionRepo.updateJobStatus(id, 'completed', {
        language,
        duration: finalDuration,
        progress: 100,
        currentStage: job.currentStage,
        workerId: job.workerId,
      })) throw new Error('Transcription worker lease was lost.');
    } catch (err) {
      const safeError = sanitizeError(err);
      job.status = 'failed';
      job.error = safeError;
      job.updatedAt = new Date().toISOString();
      transcriptionRepo.updateJobStatus(id, 'failed', {
        error: safeError,
        progress: 0,
        currentStage: 'Transcription failed.',
        workerId: job.workerId,
      });
      throw err;
    } finally {
      clearInterval(heartbeatTimer);
      transcriptionRepo.releaseTranscriptionJob(id, job.workerId);
    }
  }

  static dispatchTranscriptionJob(jobId, filePathOverride = null) {
    const activeLocalJob = jobs.get(jobId);
    if (
      activeLocalJob?.workerId === WORKER_ID &&
      TRANSCRIPTION_ACTIVE_STATUSES.has(activeLocalJob.status)
    ) return false;

    const claimed = transcriptionRepo.claimTranscriptionJob(jobId, WORKER_ID, JOB_LEASE_MS);
    if (!claimed) return false;

    const job = {
      ...transcriptionRepo.formatTranscriptionJob(claimed),
      type: 'transcription',
      userId: claimed.user_id,
      workerId: WORKER_ID,
      providerType: claimed.provider_type || 'auto',
    };
    jobs.set(job.id, job);

    const filePath = filePathOverride || resolveStoredMediaPath(job.mediaId, job.userId);
    if (job.mediaId && !filePath) {
      job.status = 'failed';
      job.progress = 0;
      job.currentStage = 'Source media is unavailable.';
      job.error = 'The source media file is missing. Upload it again before retrying transcription.';
      transcriptionRepo.updateJobStatus(job.id, 'failed', {
        error: job.error,
        progress: 0,
        currentStage: job.currentStage,
        workerId: job.workerId,
      });
      transcriptionRepo.releaseTranscriptionJob(job.id, job.workerId);
      logEvent('transcription_job_source_missing', { jobId: job.id, mediaId: job.mediaId });
      return false;
    }

    setImmediate(() => {
      this.runTranscriptionPipeline(job, {
        filePath,
        language: job.language || 'en',
        duration: job.duration,
        providerType: job.providerType,
      }).catch((error) => {
        logEvent('transcription_job_failed', { jobId: job.id, error: sanitizeError(error) });
      });
    });
    return true;
  }

  static recoverInterruptedTranscriptionJobs() {
    const recoverable = transcriptionRepo.findRecoverableTranscriptionJobs(20);
    let dispatched = 0;
    for (const storedJob of recoverable) {
      if (this.dispatchTranscriptionJob(storedJob.id)) dispatched += 1;
    }
    if (dispatched > 0) {
      logEvent('transcription_jobs_recovered', { workerId: WORKER_ID, count: dispatched });
    }
    return dispatched;
  }

  /**
   * Creates a full dubbing pipeline job
   */
  static createJob({
    userId,
    projectId,
    mediaId,
    filePath,
    originalLanguage = 'en',
    targetLanguage = 'uz',
    voiceId = 'voice-farrux',
    duration = null,
    autoCloneVoices = false,
    voiceCloningConsent = false,
  } = {}) {
    const id = `job-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const useCloning = autoCloneVoices === true;
    const authoritativeDuration = Number.isFinite(duration) && duration > 0 ? duration : null;
    const requiredMinutes = minutesForDuration(authoritativeDuration);
    if (!requiredMinutes) {
      const error = new Error('A valid server-detected media duration is required before dubbing can start.');
      error.status = 400;
      error.code = 'INVALID_MEDIA_DURATION';
      throw error;
    }
    if (!isRenderableVoiceId(voiceId)) {
      const error = new Error('The selected primary voice is not available for final dubbing.');
      error.status = 400;
      error.code = 'UNSUPPORTED_VOICE';
      throw error;
    }
    if (useCloning && (voiceCloningConsent !== true || !projectId)) {
      const error = new Error('Permission from every speaker and a saved project are required for automatic voice cloning.');
      error.status = 400;
      error.code = 'VOICE_CLONING_CONSENT_REQUIRED';
      throw error;
    }
    if (useCloning && !canCloneVoices()) {
      const error = new Error('Automatic voice cloning requires an ELEVENLABS_API_KEY.');
      error.status = 503;
      error.code = 'VOICE_CLONING_NOT_CONFIGURED';
      throw error;
    }
    const job = {
      id,
      jobId: id,
      type: 'dubbing',
      userId,
      projectId,
      mediaId,
      status: 'queued',
      progress: 0,
      currentStage: 'Queued for AI dubbing...',
      targetLanguage,
      voiceId,
      duration: authoritativeDuration,
      attempt: 1,
      maxAttempts: 3,
      params: {
        originalLanguage, targetLanguage, voiceId, duration: authoritativeDuration,
        autoCloneVoices: useCloning,
        voiceCloningConsentAt: useCloning ? new Date().toISOString() : null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createWithReservation = db.transaction(() => {
      const activeJob = projectId
        ? dubbingJobRepo.findActiveDubbingJobByProjectAndUser(projectId, userId)
        : dubbingJobRepo.findActiveDubbingJobByMediaAndUser(mediaId, userId);
      if (activeJob) {
        const error = new Error('This project already has an active dubbing job.');
        error.status = 409;
        error.code = 'DUBBING_JOB_ALREADY_ACTIVE';
        throw error;
      }

      if (projectId) {
        const project = db.prepare('SELECT segments_json, speaker_voices_json, source_media_id FROM projects WHERE id = ? AND user_id = ?')
          .get(projectId, userId);
        if (!project) {
          const error = new Error('Project not found or unauthorized.');
          error.status = 404;
          throw error;
        }
        if (useCloning && (!mediaId || mediaId !== project.source_media_id)) {
          const error = new Error('Automatic voice cloning requires the media attached to this project.');
          error.status = 400;
          error.code = 'PROJECT_MEDIA_REQUIRED';
          throw error;
        }
        if (project.segments_json) {
          let savedSegments;
          try {
            savedSegments = JSON.parse(project.segments_json);
          } catch {
            savedSegments = null;
          }
          const validation = validateTranscript(savedSegments);
          if (!validation.valid) {
            const error = new Error('The saved transcript is invalid. Correct it before starting the dub.');
            error.status = 400;
            error.code = 'INVALID_SAVED_TRANSCRIPT';
            throw error;
          }
          job.params.savedSegments = savedSegments;
          if (useCloning && savedSegments.length > 0) {
            try {
              verifyProjectDiarization({ userId, projectId, mediaId, segments: savedSegments });
            } catch (cause) {
              const error = new Error(cause.message);
              error.status = 400;
              error.code = 'SPEAKER_IDENTIFICATION_REQUIRED';
              throw error;
            }
            const samplePlan = planSpeakerSamples(savedSegments);
            if (!samplePlan.ready.length || samplePlan.insufficient.length) {
              const error = new Error('At least 10 seconds of clean, non-overlapping speech is needed for each speaker.');
              error.status = 400;
              error.code = 'INSUFFICIENT_SPEAKER_AUDIO';
              throw error;
            }
          }
        }
        if (useCloning && !job.params.savedSegments?.length) {
          const error = new Error('Transcribe the source video before automatic voice cloning.');
          error.status = 400;
          error.code = 'SPEAKER_IDENTIFICATION_REQUIRED';
          throw error;
        }
        if (project.speaker_voices_json) {
          let speakerVoices;
          try {
            speakerVoices = JSON.parse(project.speaker_voices_json);
          } catch {
            speakerVoices = null;
          }
          const validation = validateProjectPayload({ speakerVoices });
          if (!validation.valid) {
            const error = new Error('The saved speaker voice assignments are invalid. Correct them before starting the dub.');
            error.status = 400;
            error.code = 'INVALID_SPEAKER_VOICES';
            throw error;
          }
          job.params.speakerVoices = speakerVoices;
          for (const assignedVoiceId of Object.values(speakerVoices)) {
            if (!isRenderableVoiceId(assignedVoiceId)) {
              const error = new Error('A speaker voice is not available for final dubbing.');
              error.status = 400;
              error.code = 'UNSUPPORTED_SPEAKER_VOICE';
              throw error;
            }
          }
        }
      }

      dubbingJobRepo.createDubbingJob(job);
      const reservation = minuteUsageRepository.reserveMinutesForJobInTransaction({
        userId,
        projectId,
        jobId: id,
        minutes: requiredMinutes,
      });
      if (!reservation.ok) {
        throw insufficientMinutesError(requiredMinutes, reservation.balance);
      }
      return reservation;
    });
    const reservation = createWithReservation.immediate();
    job.reservedMinutes = requiredMinutes;
    job.minutesBalance = reservation.balance;
    jobs.set(id, job);

    if (projectId) {
      db.prepare(`UPDATE projects SET status = 'processing', duration = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`)
        .run(authoritativeDuration, projectId, userId);
    }

    this.dispatchPersistedJob(id, filePath);

    return job;
  }

  static async runPipeline(job, params) {
    const synthesizedSegmentFiles = [];
    let renderedMedia = null;
    let renderedAssetsRegistered = false;
    const heartbeatTimer = setInterval(() => {
      try {
        dubbingJobRepo.heartbeatDubbingJob(job.id, job.workerId, JOB_LEASE_MS);
      } catch (error) {
        logEvent('dubbing_job_heartbeat_error', { jobId: job.id, error: sanitizeError(error) });
      }
    }, Math.max(15_000, Math.floor(JOB_LEASE_MS / 3)));
    heartbeatTimer.unref?.();
    try {
      // Stage 1: Transcribing Audio (ASR)
      job.status = 'transcribing';
      job.currentStage = 'Transcribing audio with neural Whisper model...';
      job.progress = 25;
      job.updatedAt = new Date().toISOString();
      if (!persistDubbingJob(job)) throw new Error('Dubbing worker lease was lost.');

      let actualDuration = params.duration;
      if (params.filePath && (!Number.isFinite(actualDuration) || actualDuration <= 0)) {
        actualDuration = await getMediaDuration(params.filePath);
        job.duration = actualDuration;
      }

      const savedSegments = Array.isArray(params.savedSegments) ? params.savedSegments : [];
      const rawSegments = savedSegments.length > 0
        ? savedSegments
        : await transcribeAudio({
          filePath: params.filePath,
          duration: actualDuration,
          language: params.originalLanguage,
          jobId: job.id,
        });

      // Stage 2: Translating Segments
      job.status = 'translating';
      job.currentStage = `Translating spoken dialog into ${params.targetLanguage.toUpperCase()}...`;
      job.progress = 60;
      job.updatedAt = new Date().toISOString();
      if (!persistDubbingJob(job)) throw new Error('Dubbing worker lease was lost.');

      const translatedSegments = await translateSegments({
        segments: rawSegments,
        sourceLanguage: params.originalLanguage,
        targetLanguage: params.targetLanguage,
        preserveExistingTranslations: savedSegments.length > 0,
      });

      if (params.autoCloneVoices) {
        job.currentStage = 'Creating private voice clones for detected speakers...';
        job.progress = 68;
        job.updatedAt = new Date().toISOString();
        if (!persistDubbingJob(job)) throw new Error('Dubbing worker lease was lost.');
      }
      const clonedVoices = params.autoCloneVoices
        ? await cloneJobSpeakers({
          jobId: job.id,
          userId: job.userId,
          projectId: job.projectId,
          segments: rawSegments,
          consentAt: params.voiceCloningConsentAt,
        })
        : null;

      // Stage 3: Generate one voice file per timestamped segment. Keeping the
      // files separate lets the renderer preserve pauses and segment timing.
      job.status = 'synthesizing';
      job.currentStage = 'Synthesizing timestamped neural voice segments...';
      job.progress = 72;
      job.updatedAt = new Date().toISOString();
      if (!persistDubbingJob(job)) throw new Error('Dubbing worker lease was lost.');

      const spokenSegments = translatedSegments.filter((segment) =>
        (segment.translatedText || segment.originalText || '').trim() &&
        Number.isFinite(segment.startTime) && Number.isFinite(segment.endTime) &&
        segment.endTime > segment.startTime
      );
      if (spokenSegments.length === 0) {
        throw new Error('No valid translated transcript segments are available for voice synthesis.');
      }

      const concurrency = Math.max(1, readPositiveInteger(process.env.PROVIDER_CONCURRENCY, 2));
      const synthesized = new Array(spokenSegments.length);
      let nextIndex = 0;
      let completedCount = 0;
      const worker = async () => {
        while (nextIndex < spokenSegments.length) {
          const index = nextIndex;
          nextIndex += 1;
          const segment = spokenSegments[index];
        const clonedVoiceId = clonedVoices?.get(segment.speaker);
        if (params.autoCloneVoices && !clonedVoiceId) {
          throw new Error(`No cloned voice is available for ${segment.speaker || 'an unidentified speaker'}.`);
        }
          const ttsResult = await synthesizeWithRetry({
          text: segment.translatedText || segment.originalText,
          voiceId: resolveSegmentVoiceId(segment, params),
          elevenLabsVoiceId: clonedVoiceId,
          registerAsset: false,
        });
          synthesized[index] = {
          filePath: ttsResult.filePath,
          startTime: segment.startTime,
          endTime: segment.endTime,
          };
          completedCount += 1;
        job.progress = 72 + Math.round((completedCount / spokenSegments.length) * 13);
        job.updatedAt = new Date().toISOString();
        if (!persistDubbingJob(job)) throw new Error('Dubbing worker lease was lost.');
        }
      };
      await Promise.all(Array.from({ length: Math.min(concurrency, spokenSegments.length) }, () => worker()));
      synthesizedSegmentFiles.push(...synthesized);

      // Stage 4: Align generated speech to the transcript timeline and mux it
      // into a downloadable MP4 (or an audio master for audio-only sources).
      job.status = 'rendering';
      job.currentStage = 'Aligning dubbed speech and rendering final media...';
      job.progress = 88;
      job.updatedAt = new Date().toISOString();
      if (!persistDubbingJob(job)) throw new Error('Dubbing worker lease was lost.');

      if (!params.filePath) {
        throw new Error('Upload a source media file before rendering the final dub.');
      }
      const sourceMedia = job.mediaId ? mediaRepository.findByIdAndUser(job.mediaId, job.userId) : null;
      const renderVideo = sourceMedia?.media_type !== 'audio';
      const project = job.projectId
        ? db.prepare('SELECT title FROM projects WHERE id = ? AND user_id = ?').get(job.projectId, job.userId)
        : null;
      renderedMedia = await renderDubbedMedia({
        sourceFilePath: params.filePath,
        segmentAudioFiles: synthesizedSegmentFiles,
        totalDuration: job.duration,
        projectTitle: project?.title || 'dubbed-project',
        renderVideo,
      });

      const registerRenderedAssets = db.transaction(() => {
        const audioAsset = mediaRepository.createMediaAsset({
          userId: job.userId,
          projectId: job.projectId || null,
          originalFilename: renderedMedia.audioFilename,
          storedFilename: renderedMedia.audioFilename,
          storagePath: renderedMedia.audioFilePath,
          mimeType: 'audio/mp4',
          sizeBytes: renderedMedia.audioSizeBytes,
          mediaType: 'audio',
          status: 'ready',
        });
        const videoAsset = renderedMedia.videoFilePath
          ? mediaRepository.createMediaAsset({
            userId: job.userId,
            projectId: job.projectId || null,
            originalFilename: renderedMedia.videoFilename,
            storedFilename: renderedMedia.videoFilename,
            storagePath: renderedMedia.videoFilePath,
            mimeType: 'video/mp4',
            sizeBytes: renderedMedia.videoSizeBytes,
            mediaType: 'video',
            status: 'ready',
          })
          : null;
        return { audioAsset, videoAsset };
      });
      const { audioAsset, videoAsset } = registerRenderedAssets();
      renderedAssetsRegistered = true;

      // Stage 5: Completed
      job.status = 'completed';
      job.currentStage = 'AI Dubbing completed successfully!';
      job.progress = 100;
      job.result = {
        transcript: translatedSegments,
        audioUrl: `/api/media/${audioAsset.id}`,
        audioMediaId: audioAsset.id,
        videoUrl: videoAsset ? `/api/media/${videoAsset.id}` : '',
        videoMediaId: videoAsset?.id || null,
        segmentCount: translatedSegments.length,
      };
      job.updatedAt = new Date().toISOString();
      if (!persistDubbingJob(job, { result: job.result })) throw new Error('Dubbing worker lease was lost.');
      minuteUsageRepository.consumeMinutesForJob(job.id);

      // If tied to a project in DB, update project record
      if (job.projectId) {
        try {
          db.prepare(`
            UPDATE projects 
            SET segments_json = ?, output_media_id = ?, output_audio_media_id = ?,
                status = 'completed', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
          `).run(JSON.stringify(translatedSegments), videoAsset?.id || null, audioAsset.id, job.projectId, job.userId);
        } catch (dbErr) {
          console.warn('[JobManager] Could not update project in DB:', dbErr);
        }
      }
    } catch (err) {
      if (renderedMedia && !renderedAssetsRegistered) {
        for (const target of [renderedMedia.audioFilePath, renderedMedia.videoFilePath]) {
          try { if (target && fs.existsSync(target)) fs.unlinkSync(target); } catch (_) {}
        }
      }
      job.status = 'failed';
      job.error = sanitizeError(err);
      job.updatedAt = new Date().toISOString();
      const failurePersisted = persistDubbingJob(job);
      if (failurePersisted && job.projectId) {
        db.prepare(`UPDATE projects SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`)
          .run(job.projectId, job.userId);
      }
      if (failurePersisted) {
        minuteUsageRepository.refundMinutesForJob(job.id, job.error);
      }
    } finally {
      clearInterval(heartbeatTimer);
      dubbingJobRepo.releaseDubbingJob(job.id, job.workerId);
      synthesizedSegmentFiles.forEach((segment) => cleanupTempFile(segment.filePath));
      try {
        const cloneCleanupFailures = await cleanupJobVoiceClones(job.id);
        if (cloneCleanupFailures.length) {
          logEvent('voice_clone_cleanup_failed', { jobId: job.id, count: cloneCleanupFailures.length });
        }
      } catch (error) {
        logEvent('voice_clone_cleanup_failed', { jobId: job.id, error: sanitizeError(error) });
      }
    }
  }

  static dispatchPersistedJob(jobId, filePathOverride = null) {
    const activeLocalJob = jobs.get(jobId);
    if (
      activeLocalJob?.workerId === WORKER_ID &&
      LEASED_JOB_STATUSES.has(activeLocalJob.status)
    ) {
      return false;
    }

    const claimed = dubbingJobRepo.claimDubbingJob(jobId, WORKER_ID, JOB_LEASE_MS);
    if (!claimed) return false;

    const job = {
      ...dubbingJobRepo.formatDubbingJob(claimed),
      userId: claimed.user_id,
      workerId: WORKER_ID,
      params: dubbingJobRepo.getDubbingJobParams(claimed),
    };
    jobs.set(job.id, job);

    // Backward compatibility for jobs created before minute reservations were
    // introduced. Existing reservations are returned idempotently.
    const requiredMinutes = minutesForDuration(job.params.duration);
    const reservation = requiredMinutes
      ? minuteUsageRepository.reserveMinutesForJob({
        userId: job.userId,
        projectId: job.projectId,
        jobId: job.id,
        minutes: requiredMinutes,
      })
      : { ok: false, reason: 'INVALID_RESERVATION', balance: null };
    if (!reservation.ok) {
      job.status = 'failed';
      job.progress = 0;
      job.currentStage = 'Minute reservation failed.';
      job.error = reservation.reason === 'INSUFFICIENT_MINUTES'
        ? insufficientMinutesError(requiredMinutes, reservation.balance).message
        : 'The media duration is unavailable, so usage could not be reserved.';
      job.updatedAt = new Date().toISOString();
      persistDubbingJob(job);
      dubbingJobRepo.releaseDubbingJob(job.id, job.workerId);
      if (job.projectId) {
        db.prepare(`UPDATE projects SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`)
          .run(job.projectId, job.userId);
      }
      logEvent('dubbing_job_reservation_failed', { jobId: job.id, reason: reservation.reason });
      return false;
    }

    const filePath = filePathOverride || resolveStoredMediaPath(job.mediaId, job.userId);
    if (!filePath) {
      job.status = 'failed';
      job.progress = 0;
      job.currentStage = 'Source media is unavailable.';
      job.error = 'The source media file is missing. Upload it again before retrying this job.';
      job.updatedAt = new Date().toISOString();
      persistDubbingJob(job);
      dubbingJobRepo.releaseDubbingJob(job.id, job.workerId);
      minuteUsageRepository.refundMinutesForJob(job.id, job.error);
      if (job.projectId) {
        db.prepare(`UPDATE projects SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`)
          .run(job.projectId, job.userId);
      }
      logEvent('dubbing_job_source_missing', { jobId: job.id, mediaId: job.mediaId });
      return false;
    }
    const params = {
      filePath,
      originalLanguage: job.params.originalLanguage || 'en',
      targetLanguage: job.params.targetLanguage || 'uz',
      voiceId: job.params.voiceId || 'voice-farrux',
      speakerVoices: job.params.speakerVoices || {},
      duration: job.params.duration ?? null,
      savedSegments: job.params.savedSegments || [],
      autoCloneVoices: job.params.autoCloneVoices === true,
      voiceCloningConsentAt: job.params.voiceCloningConsentAt || null,
    };

    setImmediate(() => {
      this.runPipeline(job, params).catch((error) => {
        logEvent('dubbing_job_fatal_error', { jobId: job.id, error: sanitizeError(error) });
      });
    });
    return true;
  }

  static recoverInterruptedJobs() {
    const recoverable = dubbingJobRepo.findRecoverableDubbingJobs(20);
    let dispatched = 0;
    for (const storedJob of recoverable) {
      if (this.dispatchPersistedJob(storedJob.id)) {
        dispatched += 1;
      } else {
        const latest = dubbingJobRepo.findDubbingJobById(storedJob.id);
        if (latest?.status === 'failed' && latest.project_id) {
          db.prepare(`UPDATE projects SET status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`)
            .run(latest.project_id, latest.user_id);
        }
        if (latest?.status === 'failed') {
          minuteUsageRepository.refundMinutesForJob(latest.id, latest.error);
        }
      }
    }
    if (dispatched > 0) {
      logEvent('dubbing_jobs_recovered', { workerId: WORKER_ID, count: dispatched });
    }
    return dispatched;
  }

  static cleanupOrphanedArtifacts() {
    const now = Date.now();
    let deletedFiles = 0;
    let missingAssets = 0;
    let entries = [];
    try { entries = fs.readdirSync(uploadsDir, { withFileTypes: true }); } catch (_) { return { deletedFiles, missingAssets }; }

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const isPipelineArtifact = /^tts-.*\.mp3$/i.test(entry.name) || /-dubbed-[a-z0-9]+\.(m4a|mp4)$/i.test(entry.name);
      if (!isPipelineArtifact) continue;
      const tracked = db.prepare('SELECT id FROM media_assets WHERE stored_filename = ?').get(entry.name);
      if (tracked) continue;
      const filePath = path.join(uploadsDir, entry.name);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs >= ARTIFACT_RETENTION_MS) {
          fs.unlinkSync(filePath);
          deletedFiles += 1;
        }
      } catch (_) {}
    }

    const readyAssets = db.prepare(`SELECT id, stored_filename FROM media_assets WHERE status = 'ready'`).all();
    for (const asset of readyAssets) {
      const filePath = path.resolve(uploadsDir, asset.stored_filename || '');
      if (!filePath.startsWith(`${path.resolve(uploadsDir)}${path.sep}`) || !fs.existsSync(filePath)) {
        db.prepare(`UPDATE media_assets SET status = 'missing', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(asset.id);
        missingAssets += 1;
      }
    }

    if (deletedFiles || missingAssets) {
      logEvent('dubbing_artifacts_cleaned', { deletedFiles, missingAssets });
    }
    return { deletedFiles, missingAssets };
  }

  static startWorker() {
    if (workerPollTimer) return;
    const startupTasks = [
      ['minute_usage_reconciliation_error', () => minuteUsageRepository.reconcileTerminalJobs()],
      ['dubbing_artifact_cleanup_error', () => this.cleanupOrphanedArtifacts()],
      ['dubbing_job_recovery_error', () => this.recoverInterruptedJobs()],
      ['transcription_job_recovery_error', () => this.recoverInterruptedTranscriptionJobs()],
    ];
    for (const [eventName, task] of startupTasks) {
      try {
        task();
      } catch (error) {
        logEvent(eventName, { workerId: WORKER_ID, error: sanitizeError(error) });
      }
    }
    void cleanupTerminalVoiceClones()
      .then((failures) => {
        if (failures.length) logEvent('voice_clone_cleanup_failed', { count: failures.length });
      })
      .catch((error) => {
        logEvent('voice_clone_cleanup_failed', { error: sanitizeError(error) });
      });
    workerPollTimer = setInterval(() => {
      try {
        this.recoverInterruptedJobs();
      } catch (error) {
        logEvent('dubbing_worker_poll_error', { workerId: WORKER_ID, error: sanitizeError(error) });
      }
      try {
        this.recoverInterruptedTranscriptionJobs();
      } catch (error) {
        logEvent('transcription_worker_poll_error', { workerId: WORKER_ID, error: sanitizeError(error) });
      }
    }, WORKER_POLL_MS);
    workerPollTimer.unref?.();
    artifactCleanupTimer = setInterval(() => {
      try {
        this.cleanupOrphanedArtifacts();
      } catch (error) {
        logEvent('dubbing_artifact_cleanup_error', { workerId: WORKER_ID, error: sanitizeError(error) });
      }
      void cleanupTerminalVoiceClones()
        .then((failures) => {
          if (failures.length) logEvent('voice_clone_cleanup_failed', { count: failures.length });
        })
        .catch((error) => {
          logEvent('voice_clone_cleanup_failed', { error: sanitizeError(error) });
        });
    }, 60 * 60 * 1000);
    artifactCleanupTimer.unref?.();
    logEvent('dubbing_worker_started', { workerId: WORKER_ID, leaseMs: JOB_LEASE_MS });
  }

  static stopWorker() {
    if (workerPollTimer) clearInterval(workerPollTimer);
    if (artifactCleanupTimer) clearInterval(artifactCleanupTimer);
    workerPollTimer = null;
    artifactCleanupTimer = null;
  }

  /** Restarts a failed persisted dubbing job when attempts remain. */
  static retryDubbingJob({ jobId, userId, filePath = null } = {}) {
    const storedJob = dubbingJobRepo.findDubbingJobByIdAndUser(jobId, userId);
    if (!storedJob) return { error: 'Job not found or unauthorized.' };
    if (storedJob.status !== 'failed') return { error: 'Only failed jobs can be retried.' };
    if (storedJob.attempt >= storedJob.max_attempts) return { error: 'Retry limit has been reached for this job.' };

    const params = dubbingJobRepo.getDubbingJobParams(storedJob);
    const requiredMinutes = minutesForDuration(params.duration);
    if (!requiredMinutes) return { error: 'The original media duration is unavailable.' };
    const job = {
      ...dubbingJobRepo.formatDubbingJob(storedJob),
      userId,
      status: 'queued',
      progress: 0,
      currentStage: 'Retry queued for AI dubbing...',
      error: null,
      result: null,
      attempt: storedJob.attempt + 1,
      maxAttempts: storedJob.max_attempts,
      params,
      updatedAt: new Date().toISOString(),
    };

    const queueRetry = db.transaction(() => {
      const reservation = minuteUsageRepository.reserveMinutesForJobInTransaction({
        userId,
        projectId: storedJob.project_id,
        jobId,
        minutes: requiredMinutes,
      });
      if (!reservation.ok) return reservation;

      dubbingJobRepo.clearDubbingJobLease(jobId);
      const updated = dubbingJobRepo.updateDubbingJob(jobId, {
        status: job.status,
        progress: job.progress,
        currentStage: job.currentStage,
        error: null,
        attempt: job.attempt,
        params,
        result: null,
      });
      if (!updated) throw new Error('Failed to queue the dubbing retry.');
      return reservation;
    });
    const reservation = queueRetry.immediate();
    if (!reservation.ok) {
      return {
        error: insufficientMinutesError(requiredMinutes, reservation.balance).message,
        code: 'INSUFFICIENT_MINUTES',
        requiredMinutes,
        minutesBalance: reservation.balance,
      };
    }

    job.reservedMinutes = requiredMinutes;
    job.minutesBalance = reservation.balance;
    jobs.set(jobId, job);
    this.dispatchPersistedJob(jobId, filePath);

    return { job, reservedMinutes: requiredMinutes, minutesBalance: reservation.balance };
  }

  static retryTranscriptionJob({ jobId, userId, filePath = null } = {}) {
    const storedJob = transcriptionRepo.findJobByIdAndUser(jobId, userId);
    if (!storedJob) return { error: 'Transcription job not found or unauthorized.' };
    if (storedJob.status !== 'failed') return { error: 'Only failed transcription jobs can be retried.' };
    if (storedJob.attempt >= storedJob.max_attempts) return { error: 'Transcription retry limit has been reached.' };

    const nextAttempt = storedJob.attempt + 1;
    const queueRetry = db.transaction(() => {
      transcriptionRepo.clearTranscriptionLease(jobId);
      return transcriptionRepo.updateJobStatus(jobId, 'queued', {
        error: null,
        progress: 10,
        currentStage: 'Retry queued for transcription...',
        attempt: nextAttempt,
      });
    });
    if (!queueRetry.immediate()) return { error: 'Failed to queue the transcription retry.' };

    const queued = transcriptionRepo.findJobById(jobId);
    const job = transcriptionRepo.formatTranscriptionJob(queued);
    jobs.set(jobId, job);
    this.dispatchTranscriptionJob(jobId, filePath);
    return { job };
  }

  /**
   * Retrieves a job by ID, verifying user authorization
   */
  static getJob(jobId, userId) {
    if (!jobId || !userId) return null;

    // Persisted jobs use SQLite as the source of truth so a stale in-memory
    // worker cannot report an outdated state after lease recovery.
    const job = jobs.get(jobId);
    if (job?.type === 'dubbing') {
      const persistedJob = dubbingJobRepo.findDubbingJobByIdAndUser(jobId, userId);
      return persistedJob ? dubbingJobRepo.formatDubbingJob(persistedJob) : null;
    }

    if (job?.type === 'transcription') {
      const persistedJob = transcriptionRepo.findJobByIdAndUser(jobId, userId);
      if (!persistedJob) return null;
      const segments = transcriptionRepo.findSegmentsByJobId(jobId);
      return transcriptionRepo.formatTranscriptionJob(persistedJob, segments);
    }

    if (job && job.userId === userId) {
      return job;
    }

    // Fall back to database check if it's a transcription job
    const dbJob = transcriptionRepo.findJobByIdAndUser(jobId, userId);
    if (dbJob) {
      const segments = transcriptionRepo.findSegmentsByJobId(jobId);
      return transcriptionRepo.formatTranscriptionJob(dbJob, segments);
    }

    const dubbingJob = dubbingJobRepo.findDubbingJobByIdAndUser(jobId, userId);
    if (dubbingJob) return dubbingJobRepo.formatDubbingJob(dubbingJob);

    return null;
  }

  static getLatestProjectJob(projectId, userId) {
    const job = dubbingJobRepo.findLatestDubbingJobByProjectAndUser(projectId, userId);
    return job ? dubbingJobRepo.formatDubbingJob(job) : null;
  }

  static getLatestProjectTranscriptionJob(projectId, userId) {
    const job = transcriptionRepo.findLatestJobByProjectAndUser(projectId, userId);
    if (!job) return null;
    return transcriptionRepo.formatTranscriptionJob(job, transcriptionRepo.findSegmentsByJobId(job.id));
  }
}
