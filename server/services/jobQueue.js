import { randomUUID } from 'crypto';
import { transcribeAudio } from './ai/transcription.js';
import { translateSegments } from './ai/translation.js';
import { synthesizeSpeech } from './ai/tts.js';
import { getMediaDuration } from './media/durationDetector.js';
import { db } from '../db.js';
import * as transcriptionRepo from '../repositories/transcriptionRepository.js';
import { logEvent } from './logger.js';

function sanitizeError(err) {
  if (!err) return 'Transcription failed';
  const raw = typeof err === 'string' ? err : (err.message || 'Transcription failed');
  let sanitized = raw.replace(/(\/[a-zA-Z0-9_.-]+)+/g, '[path]');
  sanitized = sanitized.replace(/sk-[a-zA-Z0-9_-]{10,}/g, '[redacted_key]');
  return sanitized.split('\n')[0].trim() || 'Transcription failed';
}

// In-memory store for fast polling with DB sync
const jobs = new Map();

export class JobManager {
  /**
   * Creates a dedicated asynchronous transcription job
   */
  static createTranscriptionJob({
    userId,
    projectId = null,
    mediaId = null,
    filePath,
    language = 'en',
    duration = 30,
    providerType = 'auto',
  } = {}) {
    const id = `txjob-${Date.now()}-${randomUUID().slice(0, 8)}`;

    // Create persistent DB record
    transcriptionRepo.createTranscriptionJob({
      id,
      userId,
      projectId,
      mediaId,
      status: 'queued',
      language,
      duration: duration || 0,
    });

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
      duration: duration || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    jobs.set(id, job);
    logEvent('transcription_job_started', { jobId: id, userId, projectId, mediaId, language });

    // Execute transcription pipeline asynchronously on next event loop tick
    setImmediate(() => {
      this.runTranscriptionPipeline(job, { filePath, language, duration, providerType }).catch((err) => {
        const safeError = sanitizeError(err);
        job.status = 'failed';
        job.error = safeError;
        job.updatedAt = new Date().toISOString();
        transcriptionRepo.updateJobStatus(id, 'failed', { error: safeError });
      });
    });

    return job;
  }

  /**
   * Runs the transcription-only pipeline
   */
  static async runTranscriptionPipeline(job, { filePath, language, duration, providerType }) {
    const id = job.id;
    try {
      job.status = 'processing';
      job.currentStage = 'Extracting audio with FFmpeg & transcribing with neural model...';
      job.progress = 40;
      job.updatedAt = new Date().toISOString();
      transcriptionRepo.updateJobStatus(id, 'processing');

      // Real media duration detection (server source of truth)
      let mediaDuration = duration || 30;
      if (filePath) {
        mediaDuration = await getMediaDuration(filePath);
        job.duration = mediaDuration;
      }

      const segments = await transcribeAudio({
        filePath,
        duration: mediaDuration,
        language,
        providerType,
        jobId: id,
      });

      const finalDuration = (segments && typeof segments.duration === 'number') ? segments.duration : mediaDuration;
      job.duration = finalDuration;

      job.progress = 90;
      job.currentStage = 'Normalizing and persisting dialogue segments...';
      job.updatedAt = new Date().toISOString();

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

      transcriptionRepo.updateJobStatus(id, 'completed', { language, duration: finalDuration });
    } catch (err) {
      const safeError = sanitizeError(err);
      job.status = 'failed';
      job.error = safeError;
      job.updatedAt = new Date().toISOString();
      transcriptionRepo.updateJobStatus(id, 'failed', { error: safeError });
      throw err;
    }
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
    duration = 30,
  } = {}) {
    const id = `job-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const job = {
      id,
      jobId: id,
      type: 'dubbing',
      userId,
      projectId,
      mediaId,
      status: 'pending',
      progress: 0,
      currentStage: 'Initializing AI Dubbing Pipeline...',
      targetLanguage,
      voiceId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    jobs.set(id, job);

    // Kick off asynchronous pipeline in background
    this.runPipeline(job, { filePath, originalLanguage, targetLanguage, voiceId, duration }).catch((err) => {
      console.error(`[Job ${id}] Fatal error in pipeline:`, err);
      job.status = 'failed';
      job.error = err.message || 'Pipeline execution failed';
      job.updatedAt = new Date().toISOString();
    });

    return job;
  }

  static async runPipeline(job, params) {
    try {
      // Stage 1: Transcribing Audio (ASR)
      job.status = 'transcribing';
      job.currentStage = 'Transcribing audio with neural Whisper model...';
      job.progress = 25;
      job.updatedAt = new Date().toISOString();

      const rawSegments = await transcribeAudio({
        filePath: params.filePath,
        duration: params.duration,
        language: params.originalLanguage,
        jobId: job.id,
      });

      // Stage 2: Translating Segments
      job.status = 'translating';
      job.currentStage = `Translating spoken dialog into ${params.targetLanguage.toUpperCase()}...`;
      job.progress = 60;
      job.updatedAt = new Date().toISOString();

      const translatedSegments = await translateSegments({
        segments: rawSegments,
        sourceLanguage: params.originalLanguage,
        targetLanguage: params.targetLanguage,
      });

      // Stage 3: Neural Voice Synthesis (TTS)
      job.status = 'synthesizing';
      job.currentStage = 'Synthesizing studio neural voice clone & lip-sync cadence...';
      job.progress = 85;
      job.updatedAt = new Date().toISOString();

      const fullSpokenText = translatedSegments.map((s) => s.translatedText).join(' ');
      const ttsResult = await synthesizeSpeech({
        text: fullSpokenText,
        voiceId: params.voiceId,
        userId: job.userId,
      });

      // Stage 4: Completed
      job.status = 'completed';
      job.currentStage = 'AI Dubbing completed successfully!';
      job.progress = 100;
      job.result = {
        transcript: translatedSegments,
        audioUrl: ttsResult.audioUrl,
        segmentCount: translatedSegments.length,
      };
      job.updatedAt = new Date().toISOString();

      // If tied to a project in DB, update project record
      if (job.projectId) {
        try {
          db.prepare(`
            UPDATE projects 
            SET segments_json = ?, status = 'completed', updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ?
          `).run(JSON.stringify(translatedSegments), job.projectId, job.userId);
        } catch (dbErr) {
          console.warn('[JobManager] Could not update project in DB:', dbErr);
        }
      }
    } catch (err) {
      job.status = 'failed';
      job.error = err.message || 'Pipeline failed unexpectedly';
      job.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Retrieves a job by ID, verifying user authorization
   */
  static getJob(jobId, userId) {
    if (!jobId || !userId) return null;

    // First check memory map
    const job = jobs.get(jobId);
    if (job && job.userId === userId) {
      return job;
    }

    // Fall back to database check if it's a transcription job
    const dbJob = transcriptionRepo.findJobByIdAndUser(jobId, userId);
    if (dbJob) {
      const segments = transcriptionRepo.findSegmentsByJobId(jobId);
      return transcriptionRepo.formatTranscriptionJob(dbJob, segments);
    }

    return null;
  }
}
