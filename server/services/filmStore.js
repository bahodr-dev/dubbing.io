import { audioProvider, identityProvider } from './ai/textProvider.js';
import { separationProvider } from './filmExperiment.js';
import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs';
import { db, uploadsDir } from '../db.js';

export const FILM_STAGES = ['separation', 'transcription', 'translation', 'clone', 'speech', 'identity'];
export const filmError = (message, code, status = 409) => Object.assign(new Error(message), { code, status });
export function filmConfig() {
  const row = db.prepare('SELECT config_json FROM film_settings WHERE id = 1').get();
  return row ? JSON.parse(row.config_json) : null;
}
export function activeFilmStages() {
  return FILM_STAGES.filter(stage => !(stage === 'separation' && separationProvider() === 'none') && !(stage === 'transcription' && audioProvider() === 'transcript') && !(stage === 'identity' && identityProvider() === 'manual'));
}
export function setFilmConfig(config) {
  if (!config || !Number.isSafeInteger(config.defaultLimitMicros) || config.defaultLimitMicros <= 0 ||
      !activeFilmStages().every(k => Number.isSafeInteger(config.requestCeilingsMicros?.[k]) && config.requestCeilingsMicros[k] > 0)) {
    throw filmError('Set positive integer USD micro-dollar ceilings for all active provider request types and a default budget.', 'INVALID_FILM_PRICING', 400);
  }
  const safe = { defaultLimitMicros: config.defaultLimitMicros, requestCeilingsMicros: Object.fromEntries(FILM_STAGES.map(k => [k, activeFilmStages().includes(k) ? config.requestCeilingsMicros[k] : 0])) };
  db.prepare('INSERT INTO film_settings(id, config_json) VALUES(1, ?) ON CONFLICT(id) DO UPDATE SET config_json = excluded.config_json').run(JSON.stringify(safe));
  return safe;
}
export function initializeFilmBudget(jobId, limitMicros) {
  const config = filmConfig();
  if (!config) throw filmError('An administrator must configure provider request cost ceilings before paid film work starts.', 'FILM_PRICING_REQUIRED', 503);
  const limit = limitMicros ?? config.defaultLimitMicros;
  if (!Number.isSafeInteger(limit) || limit <= 0) throw filmError('Budget must be a positive integer in USD micro-dollars.', 'INVALID_FILM_BUDGET', 400);
  db.prepare('INSERT INTO film_budgets(job_id, limit_micros, rates_json) VALUES (?, ?, ?)').run(jobId, limit, JSON.stringify(config.requestCeilingsMicros));
}
export function estimateFilm(duration) {
  const config = filmConfig();
  if (!config) return { configured: false };
  const chunks = Math.ceil(duration / 60);
  const c = Object.fromEntries(FILM_STAGES.map(stage => [stage, activeFilmStages().includes(stage) ? config.requestCeilingsMicros[stage] : 0]));
  return { configured: true, duration, chunks, defaultLimitMicros: config.defaultLimitMicros,
    estimatedMicros: chunks * (c.separation + c.transcription + c.translation) + Math.ceil(duration / 3) * (c.clone + 4 * c.identity + 3 * c.speech + 2 * c.translation),
    accounting: 'Conservative request ceiling reservations; provider invoices may differ.' };
}
// Journal and budget reservation share one write lock. An uncertain request is
// retained and charged conservatively until an operator reconciles the outcome.
export async function filmRequest(job, stage, input, produce) {
  const key = createHash('sha256').update(JSON.stringify({ version: 1, stage, input })).digest('hex');
  const reserved = db.transaction(() => {
    const owner = db.prepare('SELECT lease_owner, lease_expires_at FROM dubbing_jobs WHERE id = ?').get(job.id);
    if (job.workerId && (owner?.lease_owner !== job.workerId || owner.lease_expires_at <= Date.now())) throw filmError('Worker lease lost.', 'LEASE_LOST');
    const row = db.prepare('SELECT * FROM film_requests WHERE project_id = ? AND request_key = ?').get(job.projectId, key);
    if (row?.state === 'complete') return { output: JSON.parse(row.output_json), cached: true };
    if (row) throw filmError('Provider outcome requires operator reconciliation before this request can run again.', 'FILM_PROVIDER_UNCERTAIN');
    const disk = fs.statfsSync(uploadsDir);
    if (Number(disk.bavail) * Number(disk.bsize) < 80 * 1024 * 1024) throw filmError('Insufficient free disk space for the next film task.', 'FILM_DISK_FULL', 507);
    const budget = db.prepare('SELECT * FROM film_budgets WHERE job_id = ?').get(job.id);
    const amount = JSON.parse(budget.rates_json)[stage];
    if (!Number.isSafeInteger(amount) || amount <= 0) throw filmError('Missing request ceiling.', 'FILM_PRICING_REQUIRED');
    if (budget.reserved_micros + amount > budget.limit_micros) throw filmError('Film spending limit reached. Increase the budget to continue.', 'FILM_BUDGET_REACHED');
    db.prepare('UPDATE film_budgets SET reserved_micros = reserved_micros + ? WHERE job_id = ?').run(amount, job.id);
    db.prepare("INSERT INTO film_requests(project_id, request_key, job_id, stage, amount_micros, state) VALUES (?, ?, ?, ?, ?, 'pending')").run(job.projectId, key, job.id, stage, amount);
    return { cached: false };
  }).immediate();
  if (reserved.cached) return reserved.output;
  try {
    const output = await produce();
    db.prepare("UPDATE film_requests SET state = 'complete', output_json = ? WHERE project_id = ? AND request_key = ?").run(JSON.stringify(output), job.projectId, key);
    return output;
  } catch (error) {
    db.prepare("UPDATE film_requests SET state = 'uncertain' WHERE project_id = ? AND request_key = ?").run(job.projectId, key);
    throw Object.assign(error, { code: error.code || 'FILM_PROVIDER_UNCERTAIN' });
  }
}
export function filmState(projectId, userId) {
  if (!db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId)) return null;
  const project = db.prepare('SELECT source_media_id, status, edit_revision FROM projects WHERE id = ?').get(projectId);
  const chunks = db.prepare('SELECT * FROM film_chunks WHERE project_id = ? AND media_id = ? ORDER BY chunk_index').all(projectId, project.source_media_id).map(r => ({ ...r, output: JSON.parse(r.output_json || '{}') }));
  const episode = db.prepare('SELECT * FROM film_episodes WHERE project_id = ?').get(projectId);
  const characters = episode?.series_id
    ? db.prepare('SELECT id, name, clone_state FROM film_characters WHERE series_id = ? AND user_id = ?').all(episode.series_id, userId)
    : db.prepare('SELECT id, name, clone_state FROM film_characters WHERE project_id = ? AND user_id = ?').all(projectId, userId);
  const budget = db.prepare('SELECT b.* FROM film_budgets b JOIN dubbing_jobs j ON j.id = b.job_id WHERE j.project_id = ? ORDER BY j.rowid DESC LIMIT 1').get(projectId);
  const unresolved = chunks.flatMap(c => (c.output.segments || []).filter(s => s.unresolvedReason));
  const metrics = {
    manualEditRevisions: project.edit_revision,
    ...db.prepare("SELECT COALESCE(SUM(amount_micros),0) AS reservedMicros, COUNT(*) AS providerRequests, SUM(CASE WHEN stage='speech' THEN 1 ELSE 0 END) AS speechRequests, SUM(CASE WHEN state!='complete' THEN 1 ELSE 0 END) AS uncertainRequests FROM film_requests WHERE project_id = ?").get(projectId),
    ...db.prepare("SELECT SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completedJobs, SUM(CASE WHEN status='partial' THEN 1 ELSE 0 END) AS partialJobs, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failedJobs FROM dubbing_jobs WHERE project_id = ? AND json_extract(params_json, '$.filmMode')=1").get(projectId),
  };
  return { projectId, status: project.status, metrics, episode, characters, chunks, budget, unresolved,
    speakers: db.prepare('SELECT * FROM film_speakers WHERE project_id = ? AND media_id = ?').all(projectId, project.source_media_id),
    requests: db.prepare('SELECT request_key, stage, state, amount_micros FROM film_requests WHERE project_id = ?').all(projectId) };
}
export function characterForSpeaker(job, chunk, speaker, manual = false) {
  return db.transaction(() => {
    const existing = db.prepare('SELECT character_id, confirmed FROM film_speakers WHERE project_id = ? AND media_id = ? AND chunk_index = ? AND speaker = ?').get(job.projectId, job.mediaId, chunk, speaker);
    if (existing) return existing;
    if (manual) {
      const prior = db.prepare('SELECT character_id FROM film_speakers WHERE project_id=? AND media_id=? AND speaker=? AND confirmed=1 LIMIT 1').get(job.projectId, job.mediaId, speaker);
      if (prior) {
        db.prepare('INSERT INTO film_speakers(project_id, media_id, chunk_index, speaker, character_id, confirmed, match_source) VALUES (?, ?, ?, ?, ?, 1, ?)').run(job.projectId, job.mediaId, chunk, speaker, prior.character_id, 'manual_annotation');
        return { character_id: prior.character_id, confirmed: 1 };
      }
    }
    const series = db.prepare('SELECT series_id FROM film_episodes WHERE project_id = ?').get(job.projectId);
    const id = `character-${randomUUID()}`;
    db.prepare('INSERT INTO film_characters(id, user_id, series_id, project_id, name) VALUES (?, ?, ?, ?, ?)').run(id, job.userId, series?.series_id || null, job.projectId, `Scene ${chunk + 1} · ${speaker}`);
    db.prepare('INSERT INTO film_speakers(project_id, media_id, chunk_index, speaker, character_id) VALUES (?, ?, ?, ?, ?)').run(job.projectId, job.mediaId, chunk, speaker, id);
    if (manual) db.prepare('UPDATE film_speakers SET confirmed=1, match_source=? WHERE project_id=? AND media_id=? AND chunk_index=? AND speaker=?').run('manual_annotation', job.projectId, job.mediaId, chunk, speaker);
    return { character_id: id, confirmed: manual ? 1 : 0 };
  }).immediate();
}
export function assertFilmFiles(output) {
  for (const file of output) if (!file || !fs.existsSync(file)) throw filmError('A saved film artifact is missing. Restore media from backup before continuing.', 'FILM_ARTIFACT_MISSING');
}
