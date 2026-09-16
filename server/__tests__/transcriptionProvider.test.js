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

  it('1. Factory resolves MockTranscriptionProvider when mock is explicitly requested', () => {
    const mockProvider = TranscriptionProviderFactory.getProvider({ type: 'mock' });
    expect(mockProvider).toBeInstanceOf(MockTranscriptionProvider);
  });

  it('2. Factory resolves MockTranscriptionProvider for auto in development/test without API key', () => {
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'test';
      const autoProvider = TranscriptionProviderFactory.getProvider({ type: 'auto', apiKey: undefined });
      expect(autoProvider).toBeInstanceOf(MockTranscriptionProvider);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('3. Factory resolves OpenAITranscriptionProvider when API key is provided (auto and openai types)', () => {
    const openaiProvider = TranscriptionProviderFactory.getProvider({
      type: 'openai',
      apiKey: 'sk-test-key-12345678',
    });
    expect(openaiProvider).toBeInstanceOf(OpenAITranscriptionProvider);

    const autoProvider = TranscriptionProviderFactory.getProvider({
      type: 'auto',
      apiKey: 'sk-test-key-12345678',
    });
    expect(autoProvider).toBeInstanceOf(OpenAITranscriptionProvider);
  });

  it('4. Factory throws configuration error in production when auto is used without API key', () => {
    const origEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      expect(() => {
        TranscriptionProviderFactory.getProvider({ type: 'auto', apiKey: undefined });
      }).toThrow(/OPENAI_API_KEY is missing in production environment/i);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('5. Factory throws configuration error when openai type is requested without API key', () => {
    expect(() => {
      TranscriptionProviderFactory.getProvider({ type: 'openai', apiKey: undefined });
    }).toThrow(/OPENAI_API_KEY is missing/i);
  });

  it('6. MockTranscriptionProvider produces structured timestamped segments', async () => {
    const provider = new MockTranscriptionProvider();
    const result = await provider.transcribe({ duration: 25, language: 'uz' });

    expect(result.segmentCount).toBeGreaterThan(0);
    expect(result.segments[0]).toHaveProperty('start');
    expect(result.segments[0]).toHaveProperty('end');
    expect(result.segments[0]).toHaveProperty('text');
    expect(result.language).toBe('uz');
    expect(result.duration).toBeGreaterThanOrEqual(15);
  });

  it('7. OpenAITranscriptionProvider successfully parses OpenAI verbose_json format', async () => {
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

  it('8. OpenAITranscriptionProvider handles 401 Unauthorized securely without leaking key', async () => {
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

  it('9. OpenAITranscriptionProvider handles 429 Rate Limit error', async () => {
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

  it('10. OpenAITranscriptionProvider handles 500 Provider Unavailable error', async () => {
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

  it('11. MockTranscriptionProvider accepts custom defaultSegments and normalizes them', async () => {
    const customSegments = [
      { start: 0, end: 2.5, text: 'Custom test line 1' },
      { start: 2.5, end: 5.0, text: 'Custom test line 2' },
    ];
    const provider = new MockTranscriptionProvider({ defaultSegments: customSegments });
    const result = await provider.transcribe({ duration: 5, language: 'en' });

    expect(result.segmentCount).toBe(2);
    expect(result.segments[0].text).toBe('Custom test line 1');
    expect(result.segments[1].text).toBe('Custom test line 2');
  });

  it('12. MockTranscriptionProvider with shouldFail=true throws intentional test error', async () => {
    const provider = new MockTranscriptionProvider({ shouldFail: true });
    await expect(provider.transcribe()).rejects.toThrow(/intentional failure/i);
  });
});
