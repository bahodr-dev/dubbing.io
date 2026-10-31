import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { app } from '../app.js';
import { db, uploadsDir } from '../db.js';
import { JobManager } from '../services/jobQueue.js';
import { filmRequest, filmState, setFilmConfig, characterForSpeaker } from '../services/filmStore.js';
import { createMediaAsset } from '../repositories/mediaRepository.js';
import * as asr from '../services/ai/transcription.js';
import * as cloning from '../services/ai/voiceCloning.js';
import * as tts from '../services/ai/tts.js';
import { getMediaDuration } from '../services/media/durationDetector.js';
import { matchFilmCharacters } from '../services/filmIdentity.js';
import * as renderer from '../services/media/dubbingRenderer.js';
import * as jobs from '../repositories/dubbingJobRepository.js';

const config = { defaultLimitMicros: 10000, requestCeilingsMicros: { separation: 10, transcription: 10, translation: 10, clone: 10, speech: 10, identity: 10 } };
function tone(seconds = 2) {
  const file = path.join(uploadsDir, `film-test-${randomUUID()}.wav`);
  expect(spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', `sine=frequency=880:duration=${seconds}`, '-ar', '48000', '-ac', '2', file], { stdio: 'ignore' }).status).toBe(0);
  return file;
}
async function setup(seconds = 2) {
  const signup = await request(app).post('/api/auth/signup').send({ email: `film-${randomUUID()}@test.uz`, password: 'Password123!', name: 'Film' });
  expect(signup.status).toBe(201);
  const userId = signup.body.user.id;
  const cookie = signup.headers['set-cookie'].find(s => s.includes('dubla_session='));
  const created = await request(app).post('/api/projects').set('Cookie', cookie).send({ title: 'Film', originalLanguage: 'en', qualityMode: 'cinema' });
  expect(created.status).toBe(201);
  const projectId = created.body.project.id;
  const source = tone(seconds);
  const media = createMediaAsset({ userId, projectId, storedFilename: path.basename(source), originalFilename: 'movie.wav', storagePath: source, mimeType: 'audio/wav', sizeBytes: fs.statSync(source).size, mediaType: 'audio' });
  db.prepare('UPDATE projects SET source_media_id = ?, duration = ? WHERE id = ?').run(media.id, seconds, projectId);
  db.prepare('UPDATE users SET minutes_balance = 100 WHERE id = ?').run(userId);
  for (const key of ['FAL_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ELEVENLABS_API_KEY']) vi.stubEnv(key, 'test');
  vi.stubEnv('CINEMA_ENABLED', 'true'); vi.stubEnv('CINEMA_USER_IDS', userId);
  setFilmConfig(config);
  vi.spyOn(JobManager, 'dispatchPersistedJob').mockReturnValue(true);
  const start = (budgetMicros = 10000) => JobManager.createJob({ userId, projectId, mediaId: media.id, duration: seconds, qualityMode: 'cinema', filmMode: true, budgetMicros });
  const run = job => JobManager.runPipeline(job, { ...job.params, filePath: source });
  return { userId, cookie, projectId, source, media, start, run };
}
function providers(source, raw) {
  const fetch = vi.fn(async url => {
    if (String(url).includes('fal.run')) return { ok: true, json: async () => ({ target: { url: 'https://v3.fal.media/dialogue' }, residual: { url: 'https://v3.fal.media/background' } }) };
    if (String(url).includes('fal.media')) return { ok: true, arrayBuffer: async () => fs.readFileSync(source) };
    if (String(url).includes('openai')) return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ translations: raw.map((s, i) => ({ id: `film-0-${i}`, text: `Salom ${i}` })) }) } }] }) };
    throw new Error(`Unexpected provider: ${url}`);
  });
  vi.stubGlobal('fetch', fetch);
  const transcribe = vi.spyOn(asr, 'transcribeAudio').mockResolvedValue(raw);
  return { fetch, transcribe };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Film cost journal and ownership', () => {
  it('refuses unconfigured pricing before holding minutes and isolates administrator settings', async () => {
    const { start, userId, cookie } = await setup();
    db.prepare('DELETE FROM film_settings').run();
    expect(() => start()).toThrow(/administrator/);
    expect(db.prepare('SELECT COUNT(*) AS n FROM dubbing_jobs WHERE user_id = ?').get(userId).n).toBe(0);
    expect(db.prepare('SELECT minutes_balance FROM users WHERE id = ?').get(userId).minutes_balance).toBe(100);
    const forbidden = await request(app).put('/api/films/settings').set('Cookie', cookie).send(config);
    expect(forbidden.status).toBe(403);
    vi.stubEnv('FILM_ADMIN_USER_IDS', userId);
    expect((await request(app).put('/api/films/settings').set('Cookie', cookie).send(config)).status).toBe(200);
  });
  it('reserves once, reuses completed requests, stops before sending over budget, and blocks ambiguous retries', async () => {
    const { start } = await setup();
    const job = start(20);
    const produce = vi.fn().mockResolvedValue({ ok: true });
    await filmRequest(job, 'speech', { text: 'A' }, produce);
    await filmRequest(job, 'speech', { text: 'A' }, produce);
    expect(produce).toHaveBeenCalledTimes(1);
    const unknown = vi.fn().mockRejectedValue(new Error('Timed out after sending'));
    await expect(filmRequest(job, 'speech', { text: 'B' }, unknown)).rejects.toThrow(/Timed out/);
    await expect(filmRequest(job, 'speech', { text: 'B' }, unknown)).rejects.toMatchObject({ code: 'FILM_PROVIDER_UNCERTAIN' });
    await expect(filmRequest(job, 'speech', { text: 'C' }, produce)).rejects.toMatchObject({ code: 'FILM_BUDGET_REACHED' });
    expect(unknown).toHaveBeenCalledTimes(1); expect(produce).toHaveBeenCalledTimes(1);
    expect(db.prepare('SELECT reserved_micros FROM film_budgets WHERE job_id = ?').get(job.id).reserved_micros).toBe(20);
  });
  it('does not let a stale worker send a paid request', async () => {
    const { start } = await setup(); const job = start();
    const produce = vi.fn();
    await expect(filmRequest({ ...job, workerId: 'stale' }, 'clone', {}, produce)).rejects.toMatchObject({ code: 'LEASE_LOST' });
    expect(produce).not.toHaveBeenCalled();
  });
  it('keeps series and characters private to the studio', async () => {
    const a = await setup();
    const series = await request(app).post('/api/films/series').set('Cookie', a.cookie).send({ title: 'Series A' });
    expect(series.status).toBe(201);
    const b = await setup();
    expect((await request(app).get(`/api/films/projects/${a.projectId}`).set('Cookie', b.cookie)).status).toBe(404);
    expect((await request(app).put(`/api/films/projects/${b.projectId}/episode`).set('Cookie', b.cookie).send({ seriesId: series.body.id })).status).toBe(404);
  });
});

describe('Film resumability and partial masters', () => {
  it('pauses before a paid task, preserves stems, resumes without repeating completed separation', async () => {
    const s = await setup();
    const raw = [{ id: 'raw', startTime: 0, endTime: 1, originalText: 'Hello', speaker: 'A', speakerSource: 'diarization' }];
    const p = providers(s.source, raw);
    const job = s.start(10); await s.run(job);
    expect(job.status).toBe('paused');
    expect(p.transcribe).not.toHaveBeenCalled();
    const separationCount = p.fetch.mock.calls.filter(([url]) => String(url).includes('fal.run')).length;
    expect(separationCount).toBe(1);
    const resumed = await request(app).post(`/api/films/jobs/${job.id}/resume`).set('Cookie', s.cookie).send({ budgetMicros: 1000 });
    expect(resumed.status).toBe(202);
    job.status = 'queued'; await s.run(job);
    expect(job.status).toBe('partial');
    expect(p.fetch.mock.calls.filter(([url]) => String(url).includes('fal.run'))).toHaveLength(1);
    expect(job.result.unresolved[0].unresolvedReason).toBe('insufficient_clean_voice_sample');
    const dialogueId = job.result.dialogueUrl.split('/').at(-1);
    const dialogueFile = db.prepare('SELECT storage_path FROM media_assets WHERE id = ?').get(dialogueId).storage_path;
    const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', dialogueFile, '-f', 'f32le', '-ac', '1', '-ar', '8000', '-'], { maxBuffer: 1000000 });
    expect(pcm.status).toBe(0);
    expect(pcm.stdout.every(byte => byte === 0)).toBe(true);
    expect(await getMediaDuration(db.prepare('SELECT storage_path FROM media_assets WHERE id = ?').get(job.result.audioMediaId).storage_path)).toBeCloseTo(2, 1);
    expect(db.prepare('SELECT status FROM minute_usage WHERE job_id = ?').get(job.id).status).toBe('consumed');
    const report = await request(app).get(`/api/films/projects/${s.projectId}/export/report`).set('Cookie', s.cookie);
    expect(report.body.unresolved).toHaveLength(1);
    const subtitles = await request(app).get(`/api/films/projects/${s.projectId}/export/srt`).set('Cookie', s.cookie);
    expect(subtitles.text).toContain('[UNRESOLVED: insufficient_clean_voice_sample]');
    const state = await request(app).get(`/api/films/projects/${s.projectId}`).set('Cookie', s.cookie);
    expect(JSON.stringify(state.body)).not.toContain(uploadsDir);
  }, 30000);
  it('clones privately once, reuses the voice and only resynthesizes the changed line', async () => {
    const s = await setup(14);
    const raw = [{ startTime: 0, endTime: 12, originalText: 'Hello', speaker: 'A', speakerSource: 'diarization' }, { startTime: 12, endTime: 13, originalText: 'Again', speaker: 'A', speakerSource: 'diarization' }];
    const p = providers(s.source, raw);
    const clone = vi.spyOn(cloning, 'createInstantVoiceClone').mockResolvedValue({ providerVoiceId: 'private-voice', requiresVerification: false });
    const synth = vi.spyOn(tts, 'synthesizeSpeech').mockImplementation(async () => ({ filePath: tone(0.5) }));
    const first = s.start(); await s.run(first);
    expect(first.status).toBe('completed'); expect(clone).toHaveBeenCalledTimes(1); expect(synth).toHaveBeenCalledTimes(2);
    const transcript = first.result.transcript.map((line, i) => i ? line : { ...line, translatedText: 'Yangi matn', translationEdited: true });
    const edit = await request(app).put(`/api/projects/${s.projectId}/transcript`).set('Cookie', s.cookie).send({ transcript }); expect(edit.status).toBe(200);
    const second = s.start(); await s.run(second);
    expect(second.status).toBe('completed'); expect(clone).toHaveBeenCalledTimes(1); expect(synth).toHaveBeenCalledTimes(3); expect(p.transcribe).toHaveBeenCalledTimes(1);
    expect(synth.mock.calls.every(([options]) => options.elevenLabsVoiceId === 'private-voice')).toBe(true);
    const character = filmState(s.projectId, s.userId).characters[0];
    expect(character.clone_state).toBe('ready');
    expect(db.prepare('SELECT provider_voice_id FROM film_characters WHERE id = ?').get(character.id).provider_voice_id).toBe('private-voice');
    expect(jobs.findDubbingJobById(second.id).status).toBe('completed');
  }, 30000);
  it('creates bounded chunks for a full film without allocating or sending the film at once', async () => {
    const s = await setup();
    db.prepare('UPDATE users SET minutes_balance = 1000 WHERE id = ?').run(s.userId);
    const job = JobManager.createJob({ userId: s.userId, projectId: s.projectId, mediaId: s.media.id, duration: 7201, qualityMode: 'cinema', filmMode: true, budgetMicros: 1 });
    // Supply enough plan minutes for this long film in the test fixture.
    await s.run(job);
    expect(job.status).toBe('paused');
    const chunks = filmState(s.projectId, s.userId).chunks;
    expect(chunks).toHaveLength(121);
    expect(chunks.every(c => c.end_time - c.start_time <= 60)).toBe(true);
    expect(chunks.at(-1).end_time).toBe(7201);
  }, 30000);
});


describe('Film identity, language and disk failures', () => {
  it('matches a later scene by isolated audio, never by its reset speaker label, and caches the comparison', async () => {
    const s = await setup(14); const job = s.start();
    const a = characterForSpeaker(job, 0, 'A');
    const b = characterForSpeaker(job, 1, 'A');
    expect(a.character_id).not.toBe(b.character_id);
    for (const [chunk, character] of [[0, a], [1, b]]) db.prepare('INSERT INTO film_samples(id, character_id, project_id, media_id, chunk_index, file_path, seconds) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(`sample-${randomUUID()}`, character.character_id, s.projectId, s.media.id, chunk, s.source, 12);
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ characterId: a.character_id, confidence: 0.96 }) }] } }] }) });
    vi.stubGlobal('fetch', fetch);
    await matchFilmCharacters(job, 1); await matchFilmCharacters(job, 1);
    expect(characterForSpeaker(job, 1, 'A').character_id).toBe(a.character_id);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body).contents[0].parts.filter(p => p.inline_data)).toHaveLength(2);
  });
  it('supports Russian input and preserves ready provider work when disk space runs out', async () => {
    const s = await setup(); const raw = [{ startTime: 0, endTime: 1, originalText: 'Привет', speaker: 'A', speakerSource: 'diarization' }];
    const p = providers(s.source, raw);
    const job = JobManager.createJob({ userId: s.userId, projectId: s.projectId, mediaId: s.media.id, duration: 2, qualityMode: 'cinema', filmMode: true, originalLanguage: 'ru' });
    const original = renderer.runFfmpeg;
    vi.spyOn(renderer, 'runFfmpeg').mockImplementation(async (...args) => {
      if (args[0].some(value => String(value).includes('anullsrc'))) throw Object.assign(new Error('No space left on device'), { code: 'ENOSPC' });
      return original(...args);
    });
    await s.run(job);
    expect(job.status).toBe('failed'); expect(p.transcribe.mock.calls[0][0].language).toBe('ru');
    expect(db.prepare('SELECT state FROM film_requests WHERE project_id = ? AND stage = ?').get(s.projectId, 'transcription').state).toBe('complete');
    expect(db.prepare('SELECT status FROM minute_usage WHERE job_id = ?').get(job.id).status).toBe('refunded');
  }, 30000);
  it('rejects oversized AI inputs before invoking a provider', async () => {
    const s = await setup(); const synth = vi.spyOn(tts, 'synthesizeSpeech');
    expect((await request(app).post('/api/dubbing/synthesize').set('Cookie', s.cookie).send({ text: 'a'.repeat(10001) })).status).toBe(400);
    expect(synth).not.toHaveBeenCalled();
  });
});
