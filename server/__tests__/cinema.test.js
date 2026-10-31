import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { spawnSync } from 'child_process';
import { app } from '../app.js';
import { db, uploadsDir } from '../db.js';
import { JobManager } from '../services/jobQueue.js';
import * as mediaRepository from '../repositories/mediaRepository.js';
import * as tts from '../services/ai/tts.js';
import * as asr from '../services/ai/transcription.js';
import { applyExpressionSuggestions, assertCinemaReady, cachedArtifact, cinemaTranslation, runCinemaPipeline } from '../services/cinema.js';
import { getMediaDuration } from '../services/media/durationDetector.js';
import { renderDubbedMedia } from '../services/media/dubbingRenderer.js';
import * as renderer from '../services/media/dubbingRenderer.js';
import * as jobs from '../repositories/dubbingJobRepository.js';

const segments = [
  { id: 'a', startTime: 0, endTime: 1, originalText: 'Hello', translatedText: 'Salom', speaker: 'Speaker 1' },
  { id: 'b', startTime: 1.5, endTime: 2.5, originalText: 'Goodbye', translatedText: 'Xayr', speaker: 'Speaker 2' },
];
async function setup() {
  const signup = await request(app).post('/api/auth/signup').send({ email: `cinema-${randomUUID()}@dubla.uz`, password: 'Password123!', name: 'Cinema tester' });
  expect(signup.status).toBe(201);
  const userId = signup.body.user.id;
  const cookie = signup.headers['set-cookie'].find(value => value.includes('dubla_session='));
  const created = await request(app).post('/api/projects').set('Cookie', cookie).send({ title: 'Cinema', transcript: segments });
  expect(created.status).toBe(201);
  vi.stubEnv('CINEMA_ENABLED', 'true'); vi.stubEnv('CINEMA_USER_IDS', userId);
  for (const key of ['FAL_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ELEVENLABS_API_KEY']) vi.stubEnv(key, 'test-key');
  return { userId, cookie, projectId: created.body.project.id };
}
function tone(hz, seconds = 3) {
  const file = path.join(uploadsDir, `cinema-test-${randomUUID()}.wav`);
  expect(spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', `sine=frequency=${hz}:duration=${seconds}`, '-ar', '48000', file], { stdio: 'ignore' }).status).toBe(0);
  return file;
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Cinema internal rollout and artifact journal', () => {
  it('gates credentials, testers, invalid quality modes and the server duration limit', async () => {
    const { userId, cookie } = await setup();
    expect(() => assertCinemaReady('cinema', userId, 300)).not.toThrow();
    expect(() => assertCinemaReady('cinema', userId, 7200)).not.toThrow();
    expect(() => assertCinemaReady('cinema', userId, 0)).toThrow(/positive finite/);
    expect(() => assertCinemaReady('unknown', userId)).toThrow(/Unsupported/);
    expect(() => assertCinemaReady('cinema', 'another-user', 10)).toThrow(/internal testers/);
    const cap = await request(app).get('/api/dubbing/capabilities').set('Cookie', cookie);
    expect(cap.body.cinema.ready).toBe(true);
    expect(JSON.stringify(cap.body)).not.toContain('test-key');
    vi.stubEnv('FAL_KEY', '');
    expect(() => assertCinemaReady('cinema', userId)).toThrow(/internal testers/);
    expect(() => assertCinemaReady('standard', userId, 900)).not.toThrow();
  });
  it('reuses completed provider work and refuses to duplicate ambiguous paid calls', async () => {
    const { projectId } = await setup();
    const create = vi.fn().mockResolvedValue({ audio: 'stored' });
    expect(await cachedArtifact(projectId, 'speech', { text: 'Salom' }, create)).toEqual({ audio: 'stored' });
    await cachedArtifact(projectId, 'speech', { text: 'Salom' }, create);
    expect(create).toHaveBeenCalledTimes(1);
    const failed = vi.fn().mockRejectedValue(new Error('Connection lost after sending request'));
    await expect(cachedArtifact(projectId, 'speech', { text: 'Ambiguous' }, failed)).rejects.toThrow(/Connection lost/);
    await expect(cachedArtifact(projectId, 'speech', { text: 'Ambiguous' }, failed)).rejects.toThrow(/operator review/);
    expect(failed).toHaveBeenCalledTimes(1);
  });
  it('keeps transcript and speakers immutable during expression analysis and flags overlap', () => {
    const original = [{ ...segments[0], endTime: 2 }, { ...segments[1], expression: 'sad', expressionEdited: true, confidence: 0.3 }];
    const result = applyExpressionSuggestions(original, [{ id: 'a', expression: 'shout', speaker: 'wrong', originalText: 'wrong' }, { id: 'b', expression: 'happy' }, { id: 'c', expression: 'neutral' }]);
    expect(result[0]).toMatchObject({ originalText: 'Hello', speaker: 'Speaker 1', expression: 'shout', qualityWarnings: ['overlapping_speech'] });
    expect(result[1].expression).toBe('sad');
    expect(result[1].qualityWarnings).toContain('uncertain_speech');
    expect(original[0].expression).toBeUndefined();
  });
  it('increments revisions only for render changes and rejects stale completion', async () => {
    const { projectId, userId, cookie } = await setup();
    vi.spyOn(JobManager, 'dispatchPersistedJob').mockReturnValue(true);
    const job = JobManager.createJob({ userId, projectId, duration: 3, speechCadence: 'natural' });
    const initial = db.prepare('SELECT edit_revision FROM projects WHERE id = ?').get(projectId).edit_revision;
    await request(app).put(`/api/projects/${projectId}`).set('Cookie', cookie).send({ title: 'Rename only', status: 'processing' });
    expect(db.prepare('SELECT edit_revision FROM projects WHERE id = ?').get(projectId).edit_revision).toBe(initial);
    const edit = await request(app).put(`/api/projects/${projectId}/transcript`).set('Cookie', cookie).send({ transcript: [{ ...segments[0], translatedText: 'Assalomu alaykum' }, segments[1]] });
    expect(edit.status).toBe(200);
    const current = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    expect(current.edit_revision).toBe(initial + 1);
    expect(JSON.parse(current.segments_json)[0].translationEdited).toBe(true);
    await expect(runCinemaPipeline(job, { duration: 3 }, () => {})).rejects.toThrow(/project changed/);
  });
});

describe('Cinema speech safety', () => {
  it('translates initial ASR text even when the normalizer copies source text into translatedText', async () => {
    const { projectId } = await setup();
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ translations: [{ id: 'a', text: 'Salom' }] }) } }] }) });
    vi.stubGlobal('fetch', fetch);
    const result = await cinemaTranslation({ projectId }, [{ ...segments[0], translatedText: 'Hello' }], 'en', 'uz', { John: 'Jon' });
    expect(result[0]).toMatchObject({ translatedText: 'Salom', translationLanguage: 'uz', translationSourceText: 'Hello' });
    expect(fetch).toHaveBeenCalledTimes(1);
    const input = JSON.parse(JSON.parse(fetch.mock.calls[0][1].body).messages[1].content);
    expect(input).toMatchObject({ glossary: { John: 'Jon' }, segments: [{ durationSeconds: 1, speaker: 'Speaker 1' }] });
  });
  it('uses Eleven v3 expression tags and never falls back to a different voice/provider', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test'); vi.stubEnv('OPENAI_API_KEY', 'test');
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 422 });
    vi.stubGlobal('fetch', fetch);
    await expect(tts.synthesizeSpeech({ text: 'Salom', qualityMode: 'cinema', expression: 'whisper' })).rejects.toThrow(/422/);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ model_id: 'eleven_v3', text: '[whispers] Salom' });
  });
  for (const manual of [true, false]) {
    it(manual ? 'flags overlong edited text without rewriting it' : 'shortens an automatic translation at most twice before fitting it', async () => {
      const { projectId, userId } = await setup();
      const source = tone(440);
      const media = mediaRepository.createMediaAsset({ userId, projectId, originalFilename: 'scene.wav', storedFilename: path.basename(source), storagePath: source,
        mimeType: 'audio/wav', sizeBytes: fs.statSync(source).size, mediaType: 'audio', status: 'ready' });
      const transcript = [{ ...segments[0], expression: 'neutral', translationEdited: manual, translationLanguage: 'uz', translationSourceText: 'Hello' }];
      db.prepare('UPDATE projects SET source_media_id = ?, segments_json = ? WHERE id = ?').run(media.id, JSON.stringify(transcript), projectId);
      await cachedArtifact(projectId, 'separation', { mediaId: media.id, model: 'fal-ai/sam-audio/separate', acceleration: 'quality', output_format: 'wav', max_chunk_duration: 60, chunk_overlap: 5 },
        async () => ({ dialogue: { filePath: source, url: '/api/media/dialogue' }, background: { filePath: source, url: '/api/media/background' } }));
      vi.spyOn(JobManager, 'dispatchPersistedJob').mockReturnValue(true);
      let synthCalls = 0;
      const synth = vi.spyOn(tts, 'synthesizeSpeech').mockImplementation(async () => ({ filePath: tone(1760, ++synthCalls < 3 ? 2 : 0.5) }));
      const fetch = vi.fn(async (_url, options) => {
        const body = JSON.parse(options.body);
        const input = JSON.parse(body.messages[1].content);
        return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ translations: [{ id: 'a', text: `Short ${input.retry.attempt}` }] }) } }] }) };
      });
      vi.stubGlobal('fetch', fetch);
      const job = JobManager.createJob({ userId, projectId, mediaId: media.id, duration: 3, qualityMode: 'cinema', speechCadence: 'natural' });
      await JobManager.runPipeline(job, { ...job.params, filePath: source });
      const saved = JSON.parse(db.prepare('SELECT segments_json FROM projects WHERE id = ?').get(projectId).segments_json)[0];
      if (manual) {
        expect(job.status).toBe('failed'); expect(saved.translatedText).toBe('Salom');
        expect(saved.regenerationStatus).toBe('needs_edit'); expect(saved.qualityWarnings).toContain('translation_too_long');
        expect(fetch).not.toHaveBeenCalled(); expect(synth).toHaveBeenCalledTimes(1);
      } else {
        expect(job.status).toBe('completed'); expect(saved.translatedText).toBe('Short 2');
        expect(fetch).toHaveBeenCalledTimes(2); expect(synth).toHaveBeenCalledTimes(3);
      }
    }, 30_000);
  }
});

describe('Cinema rendering and selective regeneration', () => {
  it('mixes only residual and new speech, preserves duration, rejects missing stems and overlong speech', async () => {
    const source = tone(440), background = tone(880), speech = tone(1760, 0.5);
    const result = await renderDubbedMedia({ sourceFilePath: source, backgroundFilePath: background, qualityMode: 'cinema',
      segmentAudioFiles: [{ filePath: speech, startTime: 0, endTime: 1 }], totalDuration: 3, renderVideo: false });
    expect(await getMediaDuration(result.audioFilePath)).toBeCloseTo(3, 1);
    const samples = spawnSync('ffmpeg', ['-v', 'error', '-i', result.audioFilePath, '-f', 'f32le', '-ac', '1', '-ar', '48000', '-'], { maxBuffer: 2_000_000 });
    expect(samples.status).toBe(0);
    const bytes = samples.stdout;
    const energy = hz => {
      let real = 0, imaginary = 0;
      for (let i = 0; i < Math.floor(bytes.length / 4); i++) {
        const sample = bytes.readFloatLE(i * 4), phase = 2 * Math.PI * hz * i / 48000;
        real += sample * Math.cos(phase); imaginary += sample * Math.sin(phase);
      }
      return Math.hypot(real, imaginary);
    };
    expect(energy(880)).toBeGreaterThan(energy(440) * 100);
    expect(energy(1760)).toBeGreaterThan(energy(440) * 10);
    await expect(renderDubbedMedia({ sourceFilePath: source, qualityMode: 'cinema', segmentAudioFiles: [{ filePath: speech, startTime: 0, endTime: 1 }], renderVideo: false })).rejects.toThrow(/separated background/);
    await expect(renderDubbedMedia({ sourceFilePath: source, qualityMode: 'cinema', backgroundFilePath: background, segmentAudioFiles: [{ filePath: source, startTime: 0, endTime: 1 }], renderVideo: false })).rejects.toThrow(/does not fit/);
  }, 30_000);
  it('synthesizes only the edited segment; failed/stale jobs preserve the prior finished output and refund once', async () => {
    const { projectId, userId, cookie } = await setup();
    const source = tone(440), background = tone(880), dialogue = tone(600);
    const media = mediaRepository.createMediaAsset({ userId, projectId, originalFilename: 'scene.wav', storedFilename: path.basename(source), storagePath: source,
      mimeType: 'audio/wav', sizeBytes: fs.statSync(source).size, mediaType: 'audio', status: 'ready' });
    const sceneTranscript = [{ ...segments[0], endTime: 0.8 }, { ...segments[1], startTime: 1, endTime: 1.8 }, { ...segments[0], id: 'c', startTime: 2, endTime: 2.8, originalText: 'Again', translatedText: 'Yana' }];
    db.prepare('UPDATE projects SET source_media_id = ?, segments_json = ? WHERE id = ?').run(media.id, JSON.stringify(sceneTranscript), projectId);
    vi.spyOn(JobManager, 'dispatchPersistedJob').mockReturnValue(true);
    vi.spyOn(asr, 'transcribeAudio').mockImplementation(async () => { throw new Error('Saved transcript must be reused'); });
    const synth = vi.spyOn(tts, 'synthesizeSpeech').mockImplementation(async () => ({ filePath: tone(1760, 0.5) }));
    vi.stubGlobal('fetch', vi.fn(async url => {
      if (String(url).includes('fal.run')) return { ok: true, json: async () => ({ target: { url: 'https://v3.fal.media/dialogue' }, residual: { url: 'https://v3.fal.media/background' } }) };
      if (String(url).includes('fal.media')) return { ok: true, arrayBuffer: async () => fs.readFileSync(String(url).endsWith('dialogue') ? dialogue : background) };
      if (String(url).includes('generativelanguage')) return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ segments: [{ id: 'a', expression: 'whisper' }, { id: 'b', expression: 'happy' }, { id: 'c', expression: 'neutral' }] }) }] } }] }) };
      throw new Error(`Unexpected provider: ${url}`);
    }));
    const start = () => JobManager.createJob({ userId, projectId, mediaId: media.id, filePath: source, duration: 3, qualityMode: 'cinema', speechCadence: 'natural' });
    const run = async job => JobManager.runPipeline(job, { ...job.params, filePath: source });
    const first = start();
    expect(() => start()).toThrow(/active dubbing job/);
    await run(first);
    expect(first.status).toBe('completed'); expect(synth).toHaveBeenCalledTimes(3);
    const saved = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    const transcript = JSON.parse(saved.segments_json);
    await request(app).put(`/api/projects/${projectId}/transcript`).set('Cookie', cookie).send({ transcript: [{ ...transcript[0], translatedText: 'Yangi salom' }, transcript[1], transcript[2]] });
    const regen = await request(app).post(`/api/dubbing/projects/${projectId}/regenerate`).set('Cookie', cookie).send({ segmentIds: ['a'] });
    expect(regen.status).toBe(202);
    const stored = jobs.findDubbingJobById(regen.body.jobId);
    const second = { ...jobs.formatDubbingJob(stored), params: jobs.getDubbingJobParams(stored) };
    await run(second);
    expect(second.status).toBe('completed'); expect(synth).toHaveBeenCalledTimes(4);
    await request(app).put(`/api/projects/${projectId}`).set('Cookie', cookie).send({ speakerVoices: { 'Speaker 1': 'voice-dilnoza' } });
    const voiceRegen = await request(app).post(`/api/dubbing/projects/${projectId}/regenerate`).set('Cookie', cookie).send({ segmentIds: ['a'] });
    expect(voiceRegen.status).toBe(202);
    const voiceStored = jobs.findDubbingJobById(voiceRegen.body.jobId);
    const voiceJob = { ...jobs.formatDubbingJob(voiceStored), params: jobs.getDubbingJobParams(voiceStored) };
    await run(voiceJob);
    expect(voiceJob.status).toBe('completed'); expect(synth).toHaveBeenCalledTimes(6);
    expect(synth.mock.calls.slice(-2).every(([options]) => options.voiceId === 'voice-dilnoza')).toBe(true);
    const finalOutput = db.prepare('SELECT output_audio_media_id FROM projects WHERE id = ?').get(projectId).output_audio_media_id;
    expect(finalOutput).not.toBe(saved.output_audio_media_id);
    const failed = start();
    const originalRender = renderer.renderDubbedMedia;
    vi.spyOn(renderer, 'renderDubbedMedia').mockImplementation(async options => {
      const rendered = await originalRender(options);
      db.prepare('UPDATE projects SET edit_revision = edit_revision + 1, segments_json = ? WHERE id = ?')
        .run(JSON.stringify([{ ...transcript[0], translatedText: 'Latest edit' }, transcript[1], transcript[2]]), projectId);
      return rendered;
    });
    await run(failed);
    expect(JSON.parse(db.prepare('SELECT segments_json FROM projects WHERE id = ?').get(projectId).segments_json)[0].translatedText).toBe('Latest edit');
    expect(failed.status).toBe('failed');
    expect(db.prepare('SELECT output_audio_media_id FROM projects WHERE id = ?').get(projectId).output_audio_media_id).toBe(finalOutput);
    expect(db.prepare('SELECT status FROM minute_usage WHERE job_id = ?').get(failed.id).status).toBe('refunded');
    const before = db.prepare('SELECT minutes_balance FROM users WHERE id = ?').get(userId).minutes_balance;
    const usage = await import('../repositories/minuteUsageRepository.js');
    usage.refundMinutesForJob(failed.id);
    expect(db.prepare('SELECT minutes_balance FROM users WHERE id = ?').get(userId).minutes_balance).toBe(before);
  }, 60_000);
});
