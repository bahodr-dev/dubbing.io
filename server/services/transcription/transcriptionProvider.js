import { ElevenLabsTranscriptionProvider } from './elevenLabsTranscriptionProvider.js';
import { audioProvider } from '../ai/textProvider.js';
import fs from 'fs';
import path from 'path';
import { normalizeTranscript } from './transcriptNormalizer.js';
import { splitAudioIntoChunks } from './transcriptionChunker.js';

function normalizeDetectedLanguage(value, fallback = 'auto') {
  const language = String(value || '').trim().toLowerCase();
  const aliases = {
    english: 'en', uzbek: 'uz', spanish: 'es', german: 'de',
    french: 'fr', japanese: 'ja', arabic: 'ar',
  };
  return aliases[language] || (/^[a-z]{2}$/.test(language) ? language : fallback);
}

/**
 * Base abstract interface for Transcription Providers
 */
export class TranscriptionProvider {
  /**
   * @param {Object} input
   * @param {string} input.audioFilePath - Path to audio file on disk
   * @param {string} [input.language] - Optional ISO 639-1 language code (e.g., 'en', 'uz')
   * @param {string} [input.prompt] - Optional prompt to guide ASR
   * @param {AbortSignal} [input.signal] - Optional abort signal
   * @returns {Promise<{ language: string, duration: number, segments: Array<Object>, segmentCount: number }>}
   */
  async transcribe(_input) {
    throw new Error('transcribe() must be implemented by transcription provider.');
  }
}

/**
 * OpenAI Whisper API Transcription Provider
 */
export class OpenAITranscriptionProvider extends TranscriptionProvider {
  constructor({
    apiKey = process.env.OPENAI_API_KEY,
    model = process.env.TRANSCRIPTION_MODEL || 'gpt-4o-transcribe-diarize',
    baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    fetchClient = globalThis.fetch,
  } = {}) {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
    this.fetch = fetchClient;
  }

  async _transcribeSingleChunk({ audioFilePath, language = 'en', prompt, signal, duration = 0, offsetSeconds = 0, speakerLabels = new Map() } = {}) {
    const fileBuffer = fs.readFileSync(audioFilePath);
    const maxBytes = Number.parseInt(process.env.TRANSCRIPTION_MAX_BYTES || '25165824', 10);
    if (fileBuffer.length > maxBytes) {
      const error = new Error(`Prepared transcription audio chunk exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MB provider limit.`);
      error.code = 'TRANSCRIPTION_FILE_TOO_LARGE';
      throw error;
    }
    const fileBlob = new Blob([fileBuffer], { type: path.extname(audioFilePath).toLowerCase() === '.mp3' ? 'audio/mpeg' : 'audio/wav' });
    const filename = path.basename(audioFilePath);

    const formData = new FormData();
    formData.append('file', fileBlob, filename);
    formData.append('model', this.model);
    const diarize = this.model === 'gpt-4o-transcribe-diarize';
    formData.append('response_format', diarize ? 'diarized_json' : this.model === 'whisper-1' ? 'verbose_json' : 'json');
    if (diarize) formData.append('chunking_strategy', 'auto');
    if (language && language !== 'auto') {
      formData.append('language', language);
    }
    if (prompt && !diarize) {
      formData.append('prompt', prompt);
    }

    const url = `${this.baseUrl.replace(/\/+$/, '')}/audio/transcriptions`;

    let response;
    try {
      response = await this.fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
        signal,
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Transcription request timed out or was aborted.');
      }
      throw new Error(`Network error connecting to transcription provider: ${err.message}`);
    }

    if (!response.ok) {
      let errorBody = {};
      try {
        errorBody = await response.json();
      } catch {}

      const msg = errorBody.error?.message || `HTTP ${response.status} ${response.statusText}`;

      if (response.status === 401) {
        throw new Error('Transcription provider authentication failed. Please verify your API key.');
      }
      if (response.status === 429) {
        throw new Error('Transcription rate limit or quota exceeded. Please try again later.');
      }
      if (response.status >= 500) {
        throw new Error('Transcription provider service temporarily unavailable. Please try again.');
      }

      throw new Error(`Transcription provider error: ${msg}`);
    }

    const data = await response.json();
    let rawSegments = Array.isArray(data.segments) ? data.segments : [];
    if (diarize) {
      rawSegments = rawSegments.map((segment) => {
        const providerSpeaker = typeof segment?.speaker === 'string' ? segment.speaker.trim() : '';
        if (!providerSpeaker) return segment;
        if (!speakerLabels.has(providerSpeaker)) {
          speakerLabels.set(providerSpeaker, `Speaker ${speakerLabels.size + 1}`);
        }
        return { ...segment, speaker: speakerLabels.get(providerSpeaker), speakerSource: 'diarization' };
      });
    }

    // Apply offset to segment timestamps
    if (offsetSeconds > 0) {
      rawSegments = rawSegments.map((segment) => ({
        ...segment,
        start: (Number(segment.start) || 0) + offsetSeconds,
        end: (Number(segment.end) || 0) + offsetSeconds,
      }));
    }

    const detectedLanguage = normalizeDetectedLanguage(data.language, language || 'auto');
    const chunkDuration = typeof data.duration === 'number' ? data.duration : (typeof duration === 'number' ? duration : 0);

    if (rawSegments.length === 0 && data.text && data.text.trim()) {
      rawSegments = [{
        start: offsetSeconds,
        end: offsetSeconds + (chunkDuration || 5.0),
        text: data.text.trim(),
      }];
    }

    return {
      rawSegments,
      language: detectedLanguage,
      duration: chunkDuration,
    };
  }

  async transcribe({ audioFilePath, language = 'en', prompt, signal, duration = 0 } = {}) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is missing. Set OPENAI_API_KEY environment variable.');
    }

    if (!audioFilePath || !fs.existsSync(audioFilePath)) {
      throw new Error('Audio file does not exist on disk.');
    }

    const fileSize = fs.statSync(audioFilePath).size;
    const maxBytes = Number.parseInt(process.env.TRANSCRIPTION_MAX_BYTES || '25165824', 10);
    const isLongDuration = typeof duration === 'number' && duration > 600;

    // If file exceeds size limit or is very long, use audio chunking pipeline
    if (fileSize > maxBytes || isLongDuration) {
      const { chunks, cleanup } = await splitAudioIntoChunks({
        audioFilePath,
        totalDuration: duration,
        chunkDurationSeconds: 600,
      });

      try {
        const allSegments = [];
        const speakerLabels = new Map();
        let detectedLanguage = language;
        let totalChunkDuration = 0;

        for (const chunk of chunks) {
          const chunkResult = await this._transcribeSingleChunk({
            audioFilePath: chunk.filePath,
            language,
            prompt,
            signal,
            duration: chunk.duration,
            offsetSeconds: chunk.offsetSeconds,
            speakerLabels,
          });

          allSegments.push(...chunkResult.rawSegments);
          detectedLanguage = chunkResult.language || detectedLanguage;
          totalChunkDuration += chunkResult.duration;
        }

        const finalDuration = totalChunkDuration > 0 ? totalChunkDuration : duration;
        const normalized = normalizeTranscript(allSegments, {
          language: detectedLanguage,
          fallbackDuration: finalDuration,
        });
        normalized.language = detectedLanguage;
        return normalized;
      } finally {
        cleanup();
      }
    }

    // Single chunk standard path
    const speakerLabels = new Map();
    const result = await this._transcribeSingleChunk({
      audioFilePath,
      language,
      prompt,
      signal,
      duration,
      offsetSeconds: 0,
      speakerLabels,
    });

    if (this.model === 'gpt-4o-transcribe-diarize' && speakerLabels.size === 0) {
      throw new Error('The transcription provider did not identify any speakers. Retry with clearer audio.');
    }

    const finalDuration = result.duration > 0 ? result.duration : (typeof duration === 'number' ? duration : 0);
    const normalized = normalizeTranscript(result.rawSegments, {
      language: result.language,
      fallbackDuration: finalDuration,
    });
    normalized.language = result.language;
    return normalized;
  }
}

/**
 * Mock Transcription Provider (Deterministic speech segmenter for tests & local development)
 */
export class MockTranscriptionProvider extends TranscriptionProvider {
  constructor({ defaultSegments = null, shouldFail = false } = {}) {
    super();
    this.defaultSegments = defaultSegments;
    this.shouldFail = shouldFail;
  }

  async transcribe({ audioFilePath: _audioFilePath, language = 'en', duration = 30, defaultSegments = null, signal: _signal } = {}) {
    if (this.shouldFail) {
      throw new Error('Mock transcription provider intentional failure for testing.');
    }

    const segmentsToUse = defaultSegments || this.defaultSegments;
    if (segmentsToUse && Array.isArray(segmentsToUse) && segmentsToUse.length > 0) {
      return normalizeTranscript(segmentsToUse, {
        language: language || 'en',
        fallbackDuration: duration || 30,
      });
    }

    const sentences = [
      "Welcome everyone to our next generation AI studio presentation.",
      "Today we are showcasing automatic video dubbing and voice synchronization.",
      "Our neural voice cloning preserves the exact emotion and cadence of the original speaker.",
      "You can seamlessly translate your video into over thirty global languages in minutes.",
      "Thank you for watching, and start creating your first multilingual dub today."
    ];

    const totalDuration = (typeof duration === 'number' && duration > 0) ? duration : 30;
    const step = totalDuration / sentences.length;

    const rawSegments = sentences.map((sentence, idx) => ({
      start: parseFloat((idx * step).toFixed(2)),
      end: parseFloat(((idx + 1) * step).toFixed(2)),
      text: sentence,
      confidence: 0.97,
    }));

    return normalizeTranscript(rawSegments, {
      language: language || 'en',
      fallbackDuration: totalDuration,
    });
  }
}

/**
 * Factory for creating/resolving transcription providers
 */
export class TranscriptionProviderFactory {
  /**
   * Returns an active transcription provider instance
   *
   * @param {Object} [options]
   * @param {'openai' | 'mock' | 'auto'} [options.type='auto']
   * @param {string} [options.apiKey]
   * @param {string} [options.model]
   * @param {Array<Object>} [options.defaultSegments]
   * @param {boolean} [options.shouldFail]
   * @returns {TranscriptionProvider}
   */
  static getProvider({
    type = 'auto',
    apiKey = process.env.OPENAI_API_KEY,
    model = process.env.TRANSCRIPTION_MODEL,
    fetchClient,
    defaultSegments = null,
    shouldFail = false,
  } = {}) {
    const isProduction = process.env.NODE_ENV === 'production';
    if (type !== 'mock' && audioProvider() === 'transcript') throw new Error('Audio transcription is disabled. DeepSeek accepts text: import SRT/JSON source subtitles.');
    if (type === 'elevenlabs' || (type === 'auto' && audioProvider() === 'elevenlabs')) {
      return new ElevenLabsTranscriptionProvider({ apiKey: process.env.ELEVENLABS_API_KEY, fetchClient });
    }
    if (!['auto', 'openai', 'mock'].includes(type)) throw new Error('Unsupported transcription provider.');

    // 1. Explicitly requested mock provider
    if (type === 'mock') {
      return new MockTranscriptionProvider({ defaultSegments, shouldFail });
    }

    // 2. Explicitly requested OpenAI provider
    if (type === 'openai') {
      if (!apiKey) {
        throw new Error('OpenAI transcription provider configuration error: OPENAI_API_KEY is missing.');
      }
      return new OpenAITranscriptionProvider({
        apiKey,
        model,
        fetchClient,
      });
    }

    // 3. Auto resolution with API key
    if (apiKey) {
      return new OpenAITranscriptionProvider({
        apiKey,
        model,
        fetchClient,
      });
    }

    // 4. Auto resolution without API key in production MUST throw
    if (isProduction) {
      throw new Error('Transcription provider configuration error: OPENAI_API_KEY is missing in production environment.');
    }

    // 5. Development/test fallback when no API key configured
    return new MockTranscriptionProvider({ defaultSegments, shouldFail });
  }
}
