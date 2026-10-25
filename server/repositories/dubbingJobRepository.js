import { db } from '../db.js';

const ACTIVE_STATUSES = ['queued', 'transcribing', 'translating', 'synthesizing', 'rendering'];

export function createDubbingJob(job) {
  db.prepare(`
    INSERT INTO dubbing_jobs (
      id, user_id, project_id, media_id, status, progress, current_stage,
      attempt, max_attempts, params_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    job.id, job.userId, job.projectId || null, job.mediaId || null,
    job.status, job.progress, job.currentStage, job.attempt, job.maxAttempts,
    JSON.stringify(job.params || {}),
  );
  return findDubbingJobById(job.id);
}

export function findDubbingJobById(id) {
  return id ? db.prepare('SELECT * FROM dubbing_jobs WHERE id = ?').get(id) : null;
}

export function findDubbingJobByIdAndUser(id, userId) {
  return id && userId
    ? db.prepare('SELECT * FROM dubbing_jobs WHERE id = ? AND user_id = ?').get(id, userId)
    : null;
}

export function findLatestDubbingJobByProjectAndUser(projectId, userId) {
  if (!projectId || !userId) return null;
  return db.prepare(`
    SELECT * FROM dubbing_jobs
    WHERE project_id = ? AND user_id = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT 1
  `).get(projectId, userId);
}

export function findActiveDubbingJobByProjectAndUser(projectId, userId) {
  if (!projectId || !userId) return null;
  return db.prepare(`
    SELECT * FROM dubbing_jobs
    WHERE project_id = ? AND user_id = ?
      AND status IN ('queued', 'transcribing', 'translating', 'synthesizing', 'rendering')
    ORDER BY created_at DESC, rowid DESC
    LIMIT 1
  `).get(projectId, userId);
}

export function findActiveDubbingJobByMediaAndUser(mediaId, userId) {
  if (!mediaId || !userId) return null;
  return db.prepare(`
    SELECT * FROM dubbing_jobs
    WHERE media_id = ? AND user_id = ?
      AND status IN ('queued', 'transcribing', 'translating', 'synthesizing', 'rendering')
    ORDER BY created_at DESC, rowid DESC
    LIMIT 1
  `).get(mediaId, userId);
}

export function getDubbingJobParams(job) {
  try {
    return JSON.parse(job?.params_json || '{}');
  } catch (_) {
    return {};
  }
}

export function updateDubbingJob(id, updates = {}) {
  const existing = findDubbingJobById(id);
  if (!existing) return false;
  const has = (key) => Object.prototype.hasOwnProperty.call(updates, key);

  const next = {
    status: has('status') ? updates.status : existing.status,
    progress: has('progress') ? updates.progress : existing.progress,
    currentStage: has('currentStage') ? updates.currentStage : existing.current_stage,
    error: has('error') ? updates.error : existing.error,
    attempt: has('attempt') ? updates.attempt : existing.attempt,
    paramsJson: has('params') ? JSON.stringify(updates.params || {}) : existing.params_json,
    resultJson: has('result') ? (updates.result ? JSON.stringify(updates.result) : null) : existing.result_json,
  };

  const workerGuard = has('workerId') ? ' AND lease_owner = ?' : '';
  const values = [
    next.status, next.progress, next.currentStage, next.error, next.attempt,
    next.paramsJson, next.resultJson, id,
  ];
  if (has('workerId')) values.push(updates.workerId);

  const result = db.prepare(`
    UPDATE dubbing_jobs
    SET status = ?, progress = ?, current_stage = ?, error = ?, attempt = ?,
        params_json = ?, result_json = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?${workerGuard}
  `).run(...values);
  return result.changes > 0;
}

export function claimDubbingJob(id, workerId, leaseMs) {
  const transaction = db.transaction(() => {
    const job = findDubbingJobById(id);
    if (!job || !ACTIVE_STATUSES.includes(job.status)) return null;

    const now = Date.now();
    const leaseAvailable = !job.lease_owner || !job.lease_expires_at || job.lease_expires_at <= now || job.lease_owner === workerId;
    if (!leaseAvailable) return null;

    const isRecovery = job.status !== 'queued' || Boolean(job.lease_owner && job.lease_owner !== workerId);
    if (isRecovery && job.attempt >= job.max_attempts) {
      db.prepare(`
        UPDATE dubbing_jobs
        SET status = 'failed', error = ?, lease_owner = NULL, lease_expires_at = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run('Job recovery limit has been reached.', id);
      return null;
    }

    const nextAttempt = isRecovery ? job.attempt + 1 : job.attempt;
    db.prepare(`
      UPDATE dubbing_jobs
      SET status = 'queued', progress = ?, current_stage = ?, attempt = ?,
          lease_owner = ?, lease_expires_at = ?, last_heartbeat_at = ?,
          error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      isRecovery ? 0 : job.progress,
      isRecovery ? 'Recovering interrupted dubbing job...' : job.current_stage,
      nextAttempt,
      workerId,
      now + leaseMs,
      now,
      id,
    );
    return findDubbingJobById(id);
  });
  // Acquire the SQLite write lock before reading the lease so two backend
  // processes cannot claim the same expired job at the same time.
  return transaction.immediate();
}

export function heartbeatDubbingJob(id, workerId, leaseMs) {
  const now = Date.now();
  const result = db.prepare(`
    UPDATE dubbing_jobs
    SET lease_expires_at = ?, last_heartbeat_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND lease_owner = ? AND status IN ('queued', 'transcribing', 'translating', 'synthesizing', 'rendering')
  `).run(now + leaseMs, now, id, workerId);
  return result.changes === 1;
}

export function releaseDubbingJob(id, workerId) {
  const result = db.prepare(`
    UPDATE dubbing_jobs
    SET lease_owner = NULL, lease_expires_at = NULL, last_heartbeat_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND lease_owner = ?
  `).run(id, workerId);
  return result.changes === 1;
}

export function clearDubbingJobLease(id) {
  db.prepare(`
    UPDATE dubbing_jobs
    SET lease_owner = NULL, lease_expires_at = NULL, last_heartbeat_at = NULL
    WHERE id = ?
  `).run(id);
}

export function findRecoverableDubbingJobs(limit = 10) {
  const now = Date.now();
  return db.prepare(`
    SELECT * FROM dubbing_jobs
    WHERE status IN ('queued', 'transcribing', 'translating', 'synthesizing', 'rendering')
      AND (lease_owner IS NULL OR lease_expires_at IS NULL OR lease_expires_at <= ?)
    ORDER BY created_at ASC
    LIMIT ?
  `).all(now, limit);
}

export function formatDubbingJob(job) {
  if (!job) return null;
  let params = {};
  let result = null;
  params = getDubbingJobParams(job);
  try { result = job.result_json ? JSON.parse(job.result_json) : null; } catch (_) {}

  return {
    id: job.id,
    jobId: job.id,
    type: 'dubbing',
    userId: job.user_id,
    projectId: job.project_id || null,
    mediaId: job.media_id || null,
    status: job.status,
    requestId: job.id,
    provider: params.provider || 'pipeline',
    progress: job.progress,
    currentStage: job.current_stage,
    error: job.error || null,
    attempt: job.attempt,
    maxAttempts: job.max_attempts,
    canRetry: job.status === 'failed' && job.attempt < job.max_attempts,
    targetLanguage: params.targetLanguage || 'uz',
    voiceId: params.voiceId || 'voice-farrux',
    duration: params.duration ?? null,
    result,
    startedAt: job.last_heartbeat_at ? new Date(job.last_heartbeat_at).toISOString() : job.created_at,
    completedAt: ['completed', 'failed'].includes(job.status) ? job.updated_at : null,
    failureCode: job.status === 'failed' ? 'DUBBING_PIPELINE_FAILED' : null,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}
