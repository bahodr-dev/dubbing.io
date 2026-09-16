import fs from 'fs';
import path from 'path';
import { normalizeTranscript } from './transcriptNormalizer.js';

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
  async transcribe(input) {
    throw new Error('transcribe() must be implemented by transcription provider.');
  }
}

/**
 * OpenAI Whisper API Transcription Provider
 */
export class OpenAITranscriptionProvider extends TranscriptionProvider {
  constructor({
    apiKey = process.env.OPENAI_API_KEY,
    model = process.env.TRANSCRIPTION_MODEL || 'whisper-1',
    baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    fetchClient = globalThis.fetch,
  } = {}) {
    super();
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
    this.fetch = fetchClient;
  }

  async transcribe({ audioFilePath, language = 'en', prompt, signal } = {}) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is missing. Set OPENAI_API_KEY environment variable.');
    }

    if (!audioFilePath || !fs.existsSync(audioFilePath)) {
      throw new Error('Audio file does not exist on disk.');
    }

    const fileBuffer = fs.readFileSync(audioFilePath);
    const fileBlob = new Blob([fileBuffer], { type: 'audio/wav' });
    const filename = path.basename(audioFilePath);

    const formData = new FormData();
    formData.append('file', fileBlob, filename);
    formData.append('model', this.model);
    formData.append('response_format', 'verbose_json');
    if (language) {
      formData.append('language', language);
    }
    if (prompt) {
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
      } catch (_) {}

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
    const rawSegments = Array.isArray(data.segments) ? data.segments : [];
    const detectedLanguage = data.language || language || 'en';
    const duration = typeof data.duration === 'number' ? data.duration : 0;

    // If verbose_json did not return segments array but returned whole text
    if (rawSegments.length === 0 && data.text && data.text.trim()) {
      return normalizeTranscript([
        {
          start: 0,
          end: duration || 5.0,
          text: data.text.trim(),
        }
      ], { language: detectedLanguage, fallbackDuration: duration });
    }

    return normalizeTranscript(rawSegments, {
      language: detectedLanguage,
      fallbackDuration: duration,
    });
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

  async transcribe({ audioFilePath, language = 'en', duration = 30, defaultSegments = null, signal } = {}) {
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

    const totalDuration = Math.max(15, duration || 30);
    const step = totalDuration / sentences.length;

    const rawSegments = sentences.map((sentence, idx) => ({
      start: parseFloat((idx * step).toFixed(2)),
      end: parseFloat(((idx + 1) * step).toFixed(2)),
      text: sentence,
      speaker: idx % 2 === 0 ? 'Speaker 1' : 'Speaker 2',
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
    if (type === 'mock') {
      return new MockTranscriptionProvider({ defaultSegments, shouldFail });
    }

    if (type === 'openai' || (type === 'auto' && apiKey)) {
      return new OpenAITranscriptionProvider({
        apiKey,
        model,
        fetchClient,
      });
    }

    // Default fallback to mock provider when no API key configured
    return new MockTranscriptionProvider({ defaultSegments, shouldFail });
  }
}
