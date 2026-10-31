import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import request from 'supertest';
import { app } from '../app.js';
import { db, uploadsDir } from '../db.js';
import { translateSegments, translateText } from '../services/ai/translation.js';
import { cinemaCapabilities, cinemaTranslation } from '../services/cinema.js';
import { matchFilmCharacters } from '../services/filmIdentity.js';
import { importSourceTranscript } from '../services/filmExperiment.js';
import { ElevenLabsTranscriptionProvider, scribeSegments } from '../services/transcription/elevenLabsTranscriptionProvider.js';
import { TranscriptionProviderFactory } from '../services/transcription/transcriptionProvider.js';
import { JobManager } from '../services/jobQueue.js';
import { setFilmConfig } from '../services/filmStore.js';
import { createMediaAsset } from '../repositories/mediaRepository.js';
import * as cloning from '../services/ai/voiceCloning.js';
import * as tts from '../services/ai/tts.js';
function experiment() {
  vi.stubEnv('TRANSLATION_PROVIDER', 'deepseek'); vi.stubEnv('DEEPSEEK_API_KEY', 'deepseek-test');
  vi.stubEnv('TRANSCRIPTION_PROVIDER', 'transcript'); vi.stubEnv('FILM_IDENTITY_PROVIDER', 'manual');
  vi.stubEnv('FILM_SEPARATION_PROVIDER', 'none'); vi.stubEnv('TTS_PROVIDER', 'elevenlabs');
  vi.stubEnv('OPENAI_API_KEY', ''); vi.stubEnv('GEMINI_API_KEY', ''); vi.stubEnv('FAL_KEY', ''); vi.stubEnv('ELEVENLABS_API_KEY', 'eleven-test');
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('DeepSeek text provider and audio boundaries', () => {
  it('routes text and batches only to DeepSeek', async () => {
    experiment(); const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: 'Salom' } }] }) }); vi.stubGlobal('fetch', fetch);
    expect(await translateText({ text: 'Hello' })).toBe('Salom');
    expect(fetch.mock.calls[0][0]).toBe('https://api.deepseek.com/chat/completions');
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ model: 'deepseek-flash', thinking: { type: 'disabled' } });
    fetch.mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ translations: [{ index: 0, translatedText: 'Salom' }] }) } }] }) });
    expect((await translateSegments({ segments: [{ originalText: 'Hello' }] }))[0].translatedText).toBe('Salom');
    expect(fetch.mock.calls.every(([url]) => url === 'https://api.deepseek.com/chat/completions')).toBe(true);
  });
  it('does not retry failed or incomplete paid DeepSeek requests through OpenAI', async () => {
    experiment(); vi.stubEnv('OPENAI_API_KEY', 'present-but-disabled');
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 }); vi.stubGlobal('fetch', fetch);
    await expect(translateText({ text: 'Hello' })).rejects.toThrow(/429/); expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockClear().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"translations":[]}' } }] }) });
    await expect(translateSegments({ segments: [{ originalText: 'Hello' }] })).rejects.toThrow(/incomplete/); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('does not treat DeepSeek as an audio or voice matching endpoint', async () => {
    experiment(); const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    expect(() => TranscriptionProviderFactory.getProvider()).toThrow(/import SRT/);
    await matchFilmCharacters({ projectId: 'none' }, 0);
    expect(fetch).not.toHaveBeenCalled();
    vi.stubEnv('CINEMA_ENABLED', 'true'); vi.stubEnv('CINEMA_USER_IDS', 'u');
    expect(cinemaCapabilities('u')).toMatchObject({ ready: true, translationProvider: 'deepseek', transcriptionProvider: 'transcript', characterMatching: 'manual', separationProvider: 'none' });
    vi.stubEnv('DEEPSEEK_API_KEY', ''); expect(cinemaCapabilities('u').ready).toBe(false);
  });
  it('imports timed source text without claiming automatic speaker recognition', () => {
    const segments = importSourceTranscript('1\n00:00:00,000 --> 00:00:12,000\n[Ali] Hello there.\n\n2\n00:00:12,000 --> 00:00:13,000\nGoodbye.');
    expect(segments[0]).toMatchObject({ speaker: 'Ali', speakerSource: 'manual', endTime: 12, translatedText: '' });
    expect(segments[1]).toMatchObject({ speaker: 'Unknown', speakerSource: 'manual-unverified' });
    expect(() => importSourceTranscript('invalid')).toThrow(/SRT timing/);
  });
  it('supports ElevenLabs Scribe as a separate optional audio provider', async () => {
    experiment(); vi.stubEnv('TRANSCRIPTION_PROVIDER', 'elevenlabs');
    const source = path.join(uploadsDir, `scribe-${randomUUID()}.wav`); fs.writeFileSync(source, 'RIFF....WAVEfmt ');
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ language_code: 'ru', words: [
      { text: 'Привет', start: 0, end: 0.5, type: 'word', speaker_id: 'a' },
      { text: ' ', start: 0.5, end: 0.6, type: 'spacing' },
      { text: 'Да.', start: 0.6, end: 1, type: 'word', speaker_id: 'b' },
    ] }) });
    const provider = new ElevenLabsTranscriptionProvider({ fetchClient: fetch });
    const result = await provider.transcribe({ audioFilePath: source, duration: 2 });
    expect(result.language).toBe('ru'); expect(result.segments.map(s => s.speaker)).toEqual(['Speaker 1', 'Speaker 2']);
    expect(result.segments.every(s => s.speakerSource === 'diarization')).toBe(true);
    expect(fetch.mock.calls[0][0]).toBe('https://api.elevenlabs.io/v1/speech-to-text');
    expect(fetch.mock.calls[0][1].body.get('diarize')).toBe('true');
    expect(scribeSegments([{ text: 'Hello', start: 0, end: 1, type: 'word' }])[0].speakerSource).toBeUndefined();
  });
});

describe('OpenAI/Gemini/FAL-free film experiment', () => {
  it('requires subtitles before reserving paid work, then produces a dialogue-only master', async () => {
    experiment();
    const signup = await request(app).post('/api/auth/signup').send({ email: `deepseek-${randomUUID()}@test.uz`, password: 'Password123!', name: 'Experiment' });
    const userId = signup.body.user.id, cookie = signup.headers['set-cookie'].find(s => s.includes('dubla_session='));
    vi.stubEnv('CINEMA_ENABLED', 'true'); vi.stubEnv('CINEMA_USER_IDS', userId);
    const created = await request(app).post('/api/projects').set('Cookie', cookie).send({ title: 'Experiment', duration: 14 });
    const projectId = created.body.project.id;
    const source = path.join(uploadsDir, `experiment-${randomUUID()}.wav`);
    expect(spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=14', source], { stdio: 'ignore' }).status).toBe(0);
    const media = createMediaAsset({ userId, projectId, originalFilename: 'source.wav', storedFilename: path.basename(source), storagePath: source, mimeType: 'audio/wav', sizeBytes: fs.statSync(source).size, mediaType: 'audio' });
    db.prepare('UPDATE projects SET source_media_id=? WHERE id=?').run(media.id, projectId);
    setFilmConfig({ defaultLimitMicros: 1000, requestCeilingsMicros: { translation: 10, clone: 10, speech: 10 } });
    vi.spyOn(JobManager, 'dispatchPersistedJob').mockReturnValue(true);
    const start = () => JobManager.createJob({ userId, projectId, mediaId: media.id, duration: 14, qualityMode: 'cinema', filmMode: true });
    expect(start).toThrow(/Import.*SRT/);
    expect(db.prepare('SELECT COUNT(*) AS n FROM dubbing_jobs WHERE project_id=?').get(projectId).n).toBe(0);
    const imported = await request(app).put(`/api/films/projects/${projectId}/source-transcript`).set('Cookie', cookie).send({ text: '1\n00:00:00,000 --> 00:00:12,000\n[Ali] Hello there.' });
    expect(imported.status).toBe(200);
    const fetch = vi.fn(async url => {
      if (url !== 'https://api.deepseek.com/chat/completions') throw new Error(`Unexpected external call: ${url}`);
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"translations":[{"id":"subtitle-0","text":"Salom"}]}' } }] }) };
    }); vi.stubGlobal('fetch', fetch);
    vi.spyOn(cloning, 'createInstantVoiceClone').mockResolvedValue({ providerVoiceId: 'clone-ali', requiresVerification: false });
    vi.spyOn(tts, 'synthesizeSpeech').mockResolvedValue({ filePath: source });
    const job = start(); await JobManager.runPipeline(job, { ...job.params, filePath: source });
    expect(job.status).toBe('completed');
    expect(job.result).toMatchObject({ backgroundPreserved: false, separationMode: 'none' });
    expect(job.result.transcript[0].qualityWarnings).toContain('background_omitted');
    expect(fetch).toHaveBeenCalledTimes(1);
    const stages = db.prepare('SELECT stage FROM film_requests WHERE project_id=?').all(projectId).map(r => r.stage);
    expect(stages).not.toContain('separation'); expect(stages).not.toContain('transcription'); expect(stages).not.toContain('identity');
  }, 30000);
});
