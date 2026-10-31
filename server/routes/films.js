import { importSourceTranscript } from '../services/filmExperiment.js';
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { db, uploadsDir } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import { aiLimiter, pollingLimiter } from '../middleware/rateLimiter.js';
import { JobManager } from '../services/jobQueue.js';
import { assertCinemaReady } from '../services/cinema.js';
import { getMediaDuration } from '../services/media/durationDetector.js';
import { filmConfig, setFilmConfig, estimateFilm, filmState, filmError } from '../services/filmStore.js';
import { filmSubtitles } from '../services/filmPipeline.js';
import * as jobRepo from '../repositories/dubbingJobRepository.js';

export const filmsRouter = Router();
filmsRouter.use(authenticateToken);
filmsRouter.use((req, res, next) => req.method === 'GET' ? pollingLimiter(req, res, next) : next());
const admin = req => (process.env.FILM_ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean).includes(req.user.id);
function ownedProject(req) {
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.projectId, req.user.id);
  if (!project) throw filmError('Project not found.', 'NOT_FOUND', 404);
  return project;
}
function assertIdle(projectId, userId) {
  if (jobRepo.findActiveDubbingJobByProjectAndUser(projectId, userId)) throw filmError('Finish or resume the active film job before editing its character memory.', 'FILM_ACTIVE');
}
const wrap = fn => async (req, res, next) => { try { await fn(req, res); } catch (e) { next(e); } };
filmsRouter.get('/settings', (req, res) => res.json({ config: filmConfig(), canConfigure: admin(req) }));
filmsRouter.put('/settings', wrap((req, res) => {
  if (!admin(req)) throw filmError('Administrator access required.', 'FORBIDDEN', 403);
  res.json({ config: setFilmConfig(req.body) });
}));
filmsRouter.get('/series', (req, res) => res.json({ series: db.prepare('SELECT id, title, glossary_json FROM film_series WHERE user_id = ?').all(req.user.id) }));
filmsRouter.post('/series', wrap((req, res) => {
  if (typeof req.body.title !== 'string' || !req.body.title.trim() || req.body.title.length > 160) throw filmError('Enter a series title up to 160 characters.', 'INVALID_SERIES', 400);
  const id = `series-${randomUUID()}`;
  db.prepare('INSERT INTO film_series(id, user_id, title) VALUES (?, ?, ?)').run(id, req.user.id, req.body.title.trim());
  res.status(201).json({ id });
}));
filmsRouter.get('/projects/:projectId', wrap((req, res) => {
  ownedProject(req);
  const state = filmState(req.params.projectId, req.user.id);
  res.json({ ...state, chunks: state.chunks.map(({ output_json: _json, output, ...chunk }) => ({ ...chunk,
    output: { segments: output.segments || [] } })) });
}));
filmsRouter.put('/projects/:projectId/episode', wrap((req, res) => {
  const project = ownedProject(req); assertIdle(project.id, req.user.id);
  const { seriesId = null, episode = '', glossary = {} } = req.body;
  if (seriesId && !db.prepare('SELECT id FROM film_series WHERE id = ? AND user_id = ?').get(seriesId, req.user.id)) throw filmError('Series not found.', 'NOT_FOUND', 404);
  if (typeof episode !== 'string' || episode.length > 120 || !glossary || typeof glossary !== 'object' || Array.isArray(glossary) || Object.entries(glossary).length > 100 || Object.entries(glossary).some(([k, v]) => k.length > 160 || typeof v !== 'string' || v.length > 500)) throw filmError('Invalid episode or glossary.', 'INVALID_EPISODE', 400);
  const existing = db.prepare('SELECT series_id FROM film_episodes WHERE project_id = ?').get(project.id);
  if (existing && existing.series_id !== seriesId && db.prepare('SELECT id FROM film_characters WHERE project_id = ? LIMIT 1').get(project.id)) throw filmError('A processed episode cannot move to another series.', 'SERIES_LOCKED');
  db.prepare(`INSERT INTO film_episodes(project_id, series_id, episode, glossary_json) VALUES (?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET series_id=excluded.series_id, episode=excluded.episode, glossary_json=excluded.glossary_json`).run(project.id, seriesId, episode, JSON.stringify(glossary));
  db.prepare('UPDATE projects SET edit_revision = edit_revision + 1 WHERE id = ?').run(project.id);
  res.json({ ok: true });
}));
filmsRouter.put('/projects/:projectId/source-transcript', wrap((req, res) => {
  const project = ownedProject(req); assertIdle(project.id, req.user.id);
  let segments;
  try { segments = importSourceTranscript(req.body.text, req.body.format || 'srt'); }
  catch (error) { throw filmError(error.message, 'INVALID_SOURCE_TRANSCRIPT', 400); }
  if (project.duration > 0 && segments.some(s => s.endTime > project.duration + 0.1)) throw filmError('Subtitles extend beyond source duration.', 'INVALID_SOURCE_TRANSCRIPT', 400);
  if (db.prepare('SELECT 1 FROM film_chunks WHERE project_id = ? LIMIT 1').get(project.id)) throw filmError('Import source subtitles before the first run. Use Studio text edits afterward.', 'SOURCE_ALREADY_PROCESSED');
  db.prepare('UPDATE projects SET segments_json = ?, edit_revision = edit_revision + 1 WHERE id = ?').run(JSON.stringify(segments), project.id);
  res.json({ segmentCount: segments.length });
}));
filmsRouter.post('/projects/:projectId/estimate', wrap(async (req, res) => {
  const project = ownedProject(req); assertCinemaReady('cinema', req.user.id);
  const media = db.prepare('SELECT stored_filename FROM media_assets WHERE id = ? AND user_id = ?').get(project.source_media_id, req.user.id);
  const source = path.resolve(uploadsDir, media?.stored_filename || '');
  if (!media || !source.startsWith(`${path.resolve(uploadsDir)}${path.sep}`) || !fs.existsSync(source)) throw filmError('Upload source media first.', 'SOURCE_REQUIRED', 422);
  const duration = await getMediaDuration(source);
  res.json(estimateFilm(duration));
}));
filmsRouter.post('/projects/:projectId/start', aiLimiter, wrap(async (req, res) => {
  const project = ownedProject(req); assertCinemaReady('cinema', req.user.id);
  const media = db.prepare('SELECT stored_filename FROM media_assets WHERE id = ? AND user_id = ?').get(project.source_media_id, req.user.id);
  const source = path.resolve(uploadsDir, media?.stored_filename || '');
  if (!media || !source.startsWith(`${path.resolve(uploadsDir)}${path.sep}`) || !fs.existsSync(source)) throw filmError('Upload source media first.', 'SOURCE_REQUIRED', 422);
  const duration = await getMediaDuration(source);
  const language = req.body.sourceLanguage || project.original_language;
  const job = JobManager.createJob({ userId: req.user.id, projectId: project.id, mediaId: project.source_media_id,
    filePath: source, duration, originalLanguage: language, targetLanguage: 'uz', qualityMode: 'cinema', filmMode: true,
    budgetMicros: req.body.budgetMicros, autoCloneVoices: true });
  db.prepare('UPDATE projects SET original_language = ?, target_language = ? WHERE id = ?').run(language, 'uz', project.id);
  res.status(202).json({ jobId: job.id, status: job.status });
}));
filmsRouter.post('/jobs/:jobId/resume', aiLimiter, wrap((req, res) => {
  const job = jobRepo.findDubbingJobByIdAndUser(req.params.jobId, req.user.id);
  if (!job || !jobRepo.getDubbingJobParams(job).filmMode) throw filmError('Film job not found.', 'NOT_FOUND', 404);
  if (job.status !== 'paused') throw filmError('Only paused film jobs can resume.', 'FILM_NOT_PAUSED');
  const limit = req.body.budgetMicros;
  const updated = db.transaction(() => {
    const budget = db.prepare('SELECT * FROM film_budgets WHERE job_id = ?').get(job.id);
    if (!Number.isSafeInteger(limit) || limit < budget.limit_micros || limit <= budget.reserved_micros) throw filmError('Set a budget above current reservations and at least the previous limit.', 'INVALID_FILM_BUDGET', 400);
    db.prepare('UPDATE film_budgets SET limit_micros = ? WHERE job_id = ?').run(limit, job.id);
    if (!db.prepare("UPDATE dubbing_jobs SET status='queued', error=NULL, lease_owner=NULL, lease_expires_at=NULL WHERE id = ? AND status='paused'").run(job.id).changes) throw filmError('Film is already resuming.', 'FILM_ACTIVE');
    db.prepare("UPDATE projects SET status='processing' WHERE id = ?").run(job.project_id);
    return true;
  }).immediate();
  if (updated) JobManager.dispatchPersistedJob(job.id);
  res.status(202).json({ jobId: job.id });
}));
filmsRouter.put('/projects/:projectId/speakers', wrap((req, res) => {
  const project = ownedProject(req); assertIdle(project.id, req.user.id);
  const { chunkIndex, speaker, characterId } = req.body;
  const state = filmState(project.id, req.user.id);
  if (!Number.isInteger(chunkIndex) || typeof speaker !== 'string' || !state.characters.some(c => c.id === characterId)) throw filmError('Choose a character in this project or series.', 'INVALID_CHARACTER', 400);
  db.transaction(() => {
    const old = db.prepare('SELECT character_id FROM film_speakers WHERE project_id = ? AND media_id = ? AND chunk_index = ? AND speaker = ?').get(project.id, project.source_media_id, chunkIndex, speaker);
    if (!old) throw filmError('Speaker not found.', 'NOT_FOUND', 404);
    db.prepare('UPDATE film_speakers SET character_id = ?, confirmed = 1 WHERE project_id = ? AND media_id = ? AND chunk_index = ? AND speaker = ?').run(characterId, project.id, project.source_media_id, chunkIndex, speaker);
    if (old.character_id !== characterId) {
      db.prepare('UPDATE OR IGNORE film_samples SET character_id = ? WHERE character_id = ? AND project_id = ? AND media_id = ? AND chunk_index = ?').run(characterId, old.character_id, project.id, project.source_media_id, chunkIndex);
    }
    db.prepare('UPDATE projects SET edit_revision = edit_revision + 1 WHERE id = ?').run(project.id);
  }).immediate();
  res.json({ ok: true });
}));
// Reconciliation is explicit: a provider receipt/output or a confirmed absence
// is required. Merely timing out never makes a request safe to resubmit.
filmsRouter.post('/projects/:projectId/requests/:key/reconcile', wrap((req, res) => {
  ownedProject(req);
  if (!admin(req)) throw filmError('Administrator access required.', 'FORBIDDEN', 403);
  const row = db.prepare('SELECT * FROM film_requests WHERE project_id = ? AND request_key = ?').get(req.params.projectId, req.params.key);
  if (!row || row.state === 'complete') throw filmError('No uncertain request found.', 'NOT_FOUND', 404);
  const job = jobRepo.findDubbingJobById(row.job_id);
  if (!['paused', 'failed', 'partial', 'completed'].includes(job.status)) throw filmError('Wait until the worker has stopped.', 'FILM_ACTIVE');
  if (req.body.confirmedNotSubmitted !== true || typeof req.body.providerEvidence !== 'string' || req.body.providerEvidence.trim().length < 10) throw filmError('Supply provider evidence and confirmedNotSubmitted after checking provider records.', 'RECONCILIATION_REQUIRED', 400);
  db.transaction(() => {
    db.prepare('DELETE FROM film_requests WHERE project_id = ? AND request_key = ?').run(row.project_id, row.request_key);
    db.prepare('UPDATE film_budgets SET reserved_micros = reserved_micros - ? WHERE job_id = ?').run(row.amount_micros, row.job_id);
  }).immediate();
  res.json({ ok: true });
}));
filmsRouter.get('/projects/:projectId/export/:format', wrap((req, res) => {
  const project = ownedProject(req);
  const state = filmState(project.id, req.user.id);
  const segments = state.chunks.flatMap(c => c.output.segments || []);
  const format = req.params.format;
  res.set('Content-Disposition', `attachment; filename="film-review.${format === 'report' ? 'json' : format}"`);
  if (format === 'report') return res.json({ projectId: project.id, status: project.status, processingMode: { separation: process.env.FILM_SEPARATION_PROVIDER || 'fal', transcription: process.env.TRANSCRIPTION_PROVIDER || 'openai', translation: process.env.TRANSLATION_PROVIDER || 'openai', identity: process.env.FILM_IDENTITY_PROVIDER || 'gemini' }, budget: state.budget, metrics: state.metrics, unresolved: state.unresolved,
    warnings: segments.filter(s => s.qualityWarnings?.length).map(s => ({ id: s.id, startTime: s.startTime, endTime: s.endTime, warnings: s.qualityWarnings })),
    chunks: state.chunks.map(c => ({ index: c.chunk_index, start: c.start_time, end: c.end_time, state: c.state, stage: c.stage, error: c.error })) });
  if (!['srt', 'vtt'].includes(format)) throw filmError('Use report, srt or vtt.', 'INVALID_FORMAT', 400);
  res.type(format === 'vtt' ? 'text/vtt' : 'text/plain').send(filmSubtitles(segments, format === 'vtt'));
}));
