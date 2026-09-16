import { validateMediaFile } from '../media/mediaValidator.js';
import { extractAudioFromMedia, cleanupTempFile } from '../media/audioExtractor.js';
import { getMediaDuration } from '../media/durationDetector.js';
import { TranscriptionProviderFactory } from '../transcription/transcriptionProvider.js';
import { logEvent } from '../logger.js';

/**
 * Production-Ready Real Video & Audio Transcription Service
 *
 * Pipeline:
 * 1. Validate media file
 * 2. Detect actual media duration from file (FFprobe / FFmpeg)
 * 3. Extract & normalize audio with FFmpeg (16kHz mono WAV)
 * 4. Transcribe via provider abstraction (OpenAI Whisper / fallback)
 * 5. Normalize & timestamp segments
 * 6. Clean up temporary audio files
 *
 * @param {Object} options
 * @param {string} [options.filePath] - Path to local video or audio file
 * @param {string} [options.language='en'] - Spoken language
 * @param {number} [options.duration] - Client provided or fallback duration in seconds
 * @param {string} [options.providerType='auto'] - Provider type ('auto', 'openai', 'mock')
 * @param {string} [options.jobId] - Optional tracking job ID
 * @returns {Promise<Array<Object>>}
 */
export async function transcribeAudio({
  filePath,
  duration,
  language = 'en',
  providerType = 'auto',
  jobId = null,
} = {}) {
  // If no file path provided, resolve provider according to providerType and environment
  if (!filePath) {
    const provider = TranscriptionProviderFactory.getProvider({ type: providerType });
    const result = await provider.transcribe({ duration: duration || 30, language });
    return result.segments;
  }

  // 1. Validate Media File
  const validation = validateMediaFile({ filePath });
  if (!validation.isValid) {
    throw new Error(`Media validation failed: ${validation.error}`);
  }

  // 2. Detect Real Media Duration (server source of truth)
  const actualDuration = await getMediaDuration(filePath);

  let audioPathToClean = null;
  let targetAudioPath = filePath;

  try {
    // 3. Extract & normalize audio using FFmpeg if input is video or needs audio extraction
    const startTime = Date.now();
    logEvent('audio_extraction_started', { jobId, inputPath: filePath, format: validation.detectedFormat, duration: actualDuration });

    try {
      const extractionResult = await extractAudioFromMedia({ inputFilePath: filePath });
      targetAudioPath = extractionResult.audioFilePath;
      audioPathToClean = extractionResult.audioFilePath;
      logEvent('audio_extraction_completed', {
        jobId,
        durationMs: Date.now() - startTime,
        audioPath: targetAudioPath,
      });
    } catch (extractErr) {
      logEvent('warn', {
        message: 'FFmpeg extraction skipped or failed, attempting direct provider ingestion',
        error: extractErr.message,
      });
      // If FFmpeg is not installed or failed, but file is already audio, we can try direct ingestion
      if (validation.mediaType === 'audio') {
        targetAudioPath = filePath;
      } else {
        throw extractErr;
      }
    }

    // 4. Transcribe with Provider Abstraction using real detected duration
    const provider = TranscriptionProviderFactory.getProvider({ type: providerType });
    logEvent('transcription_started', {
      jobId,
      provider: provider.constructor.name,
      language,
      duration: actualDuration,
    });

    const result = await provider.transcribe({
      audioFilePath: targetAudioPath,
      language,
      duration: actualDuration,
    });

    logEvent('transcription_completed', {
      jobId,
      segmentCount: result.segments.length,
      duration: actualDuration,
      language: result.language,
    });

    result.segments.duration = actualDuration;
    return result.segments;
  } catch (err) {
    logEvent('transcription_failed', {
      jobId,
      error: err.message,
    });
    throw err;
  } finally {
    // 4. Temporary audio cleanup (guaranteed in all outcomes)
    if (audioPathToClean) {
      cleanupTempFile(audioPathToClean);
    }
  }
}
