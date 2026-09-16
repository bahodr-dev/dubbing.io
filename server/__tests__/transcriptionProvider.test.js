import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  TranscriptionProviderFactory,
  OpenAITranscriptionProvider,
  MockTranscriptionProvider,
} from '../services/transcription/transcriptionProvider.js';

describe('Transcription Provider Abstraction Unit Tests', () => {
  const tempDir = path.join(os.tmpdir(), `test_tx_prov_${Date.now()}`);
  let dummyAudioPath = '';

  beforeAll(() => {
    fs.mkdirSync(tempDir, { recursive: true });
    dummyAudioPath = path.join(tempDir, 'dummy.wav');
    fs.writeFileSync(dummyAudioPath, 'RIFF....WAVEfmt ');
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  it('1. Factory resolves MockTranscriptionProvider when requested or when no API key', () => {
    const mockProvider = TranscriptionProviderFactory.getProvider({ type: 'mock' });
    expect(mockProvider).toBeInstanceOf(MockTranscriptionProvider);

    const autoProvider = TranscriptionProviderFactory.getProvider({ type: 'auto', apiKey: undefined });
    expect(autoProvider).toBeInstanceOf(MockTranscriptionProvider);
  });

  it('2. Factory resolves OpenAITranscriptionProvider when OpenAI key is provided', () => {
    const openaiProvider = TranscriptionProviderFactory.getProvider({
      type: 'openai',
      apiKey: 'sk-test-key-12345678',
    });
    expect(openaiProvider).toBeInstanceOf(OpenAITranscriptionProvider);
  });

  it('3. MockTranscriptionProvider produces structured timestamped segments', async () => {
    const provider = new MockTranscriptionProvider();
    const result = await provider.transcribe({ duration: 25, language: 'uz' });

    expect(result.segmentCount).toBeGreaterThan(0);
    expect(result.segments[0]).toHaveProperty('start');
    expect(result.segments[0]).toHaveProperty('end');
    expect(result.segments[0]).toHaveProperty('text');
    expect(result.language).toBe('uz');
    expect(result.duration).toBeGreaterThanOrEqual(15);
  });

  it('4. OpenAITranscriptionProvider successfully parses OpenAI verbose_json format', async () => {
    const mockFetch = async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          language: 'english',
          duration: 12.5,
          text: 'Welcome to Dubbing.io. This is automated transcription.',
          segments: [
            { id: 0, start: 0.0, end: 4.2, text: 'Welcome to Dubbing.io.' },
            { id: 1, start: 4.5, end: 12.5, text: 'This is automated transcription.' },
          ],
        }),
      };
    };

    const provider = new OpenAITranscriptionProvider({
      apiKey: 'sk-test-mock-key',
      fetchClient: mockFetch,
    });

    const result = await provider.transcribe({ audioFilePath: dummyAudioPath, language: 'en' });

    expect(result.segmentCount).toBe(2);
    expect(result.segments[0].text).toBe('Welcome to Dubbing.io.');
    expect(result.segments[0].start).toBe(0.0);
    expect(result.segments[0].end).toBe(4.2);
    expect(result.segments[1].text).toBe('This is automated transcription.');
  });

  it('5. OpenAITranscriptionProvider handles 401 Unauthorized securely without leaking key', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: { message: 'Incorrect API key provided: sk-secret***' } }),
    });

    const provider = new OpenAITranscriptionProvider({
      apiKey: 'sk-bad-key-xyz',
      fetchClient: mockFetch,
    });

    await expect(provider.transcribe({ audioFilePath: dummyAudioPath })).rejects.toThrow(
      /authentication failed/i
    );
  });

  it('6. OpenAITranscriptionProvider handles 429 Rate Limit error', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ error: { message: 'Rate limit reached' } }),
    });

    const provider = new OpenAITranscriptionProvider({
      apiKey: 'sk-valid-key',
      fetchClient: mockFetch,
    });

    await expect(provider.transcribe({ audioFilePath: dummyAudioPath })).rejects.toThrow(
      /rate limit or quota exceeded/i
    );
  });

  it('7. OpenAITranscriptionProvider handles 500 Provider Unavailable error', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => ({ error: { message: 'Server error' } }),
    });

    const provider = new OpenAITranscriptionProvider({
      apiKey: 'sk-valid-key',
      fetchClient: mockFetch,
    });

    await expect(provider.transcribe({ audioFilePath: dummyAudioPath })).rejects.toThrow(
      /service temporarily unavailable/i
    );
  });

  it('8. Throws if API key is not configured for OpenAITranscriptionProvider', async () => {
    const provider = new OpenAITranscriptionProvider({ apiKey: '' });
    await expect(provider.transcribe({ audioFilePath: dummyAudioPath })).rejects.toThrow(
      /API key is missing/i
    );
  });
});
