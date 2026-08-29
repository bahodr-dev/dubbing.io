import { randomUUID } from 'crypto';
import { transcribeAudio } from './ai/transcription.js';
import { translateSegments } from './ai/translation.js';
import { synthesizeSpeech } from './ai/tts.js';
import { db } from '../db.js';

// In-memory store for real-time fast access with DB sync
const jobs = new Map();

export class JobManager {
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

    // Kick off asynchronous pipeline in background (Non-blocking)
    this.runPipeline(job, { filePath, originalLanguage, targetLanguage, voiceId, duration }).catch((err) => {
      console.error(`[Job ${id}] Fatal error in pipeline:`, err);
      job.status = 'failed';
      job.error = err.message || 'Pipeline execution failed';
      job.updatedAt = new Date().toISOString();
    });

    return job;
  }

  static async runPipeline(
    job,
    params
  ) {
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

  static getJob(jobId, userId) {
    const job = jobs.get(jobId);
    if (!job || job.userId !== userId) {
      return null;
    }
    return job;
  }
}
