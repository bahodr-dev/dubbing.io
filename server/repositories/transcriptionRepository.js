import { randomUUID } from 'crypto';
import { db } from '../db.js';

const ACTIVE_STATUSES = ['queued', 'processing'];

/**
 * Formats a raw database transcription job row for client response
 */
export function formatTranscriptionJob(job, segments = []) {
  if (!job) return null;
  const formattedSegments = segments.map((s) => ({
    id: s.id,
    start: s.start_time,
    end: s.end_time,
    text: s.text,
    startTime: s.start_time,
    endTime: s.end_time,
    originalText: s.text,
    ...(s.speaker ? { speaker: s.speaker } : {}),
    ...(s.speaker_source === 'diarization' ? { speakerSource: 'diarization' } : {}),
    confidence: s.confidence || 0.95,
  }));

  const parsedDuration = (typeof job.duration === 'number' && !isNaN(job.duration)) ? job.duration : null;

  return {
    id: job.id,
    jobId: job.id,
    userId: job.user_id,
    projectId: job.project_id || null,
    mediaId: job.media_id || null,
    status: job.status,
    requestId: job.id,
    provider: job.provider_type || 'auto',
    type: 'transcription',
    progress: job.status === 'completed'
      ? 100
      : typeof job.progress === 'number'
        ? job.progress
        : (job.status === 'processing' ? 50 : 10),
    currentStage: job.current_stage || null,
    language: job.language || 'en',
    duration: parsedDuration,
    error: job.error || null,
    attempt: job.attempt || 1,
    maxAttempts: job.max_attempts || 3,
    canRetry: job.status === 'failed' && (job.attempt || 1) < (job.max_attempts || 3),
    segments: formattedSegments,
    result: job.status === 'completed' ? {
      segments: formattedSegments,
      segmentCount: formattedSegments.length,
      language: job.language || 'en',
      duration: parsedDuration ?? 0,
    } : null,
    startedAt: job.last_heartbeat_at ? new Date(job.last_heartbeat_at).toISOString() : job.created_at,
    completedAt: ['completed', 'failed'].includes(job.status) ? job.updated_at : null,
    failureCode: job.status === 'failed' ? 'TRANSCRIPTION_FAILED' : null,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

/**
 * Creates a new transcription job in database
 */
export function createTranscriptionJob({
  id,
  userId,
  projectId = null,
  mediaId = null,
  status = 'queued',
  language = 'en',
  duration = null,
  providerType = 'auto',
  progress = 10,
  currentStage = 'Queued for transcription...',
  attempt = 1,
  maxAttempts = 3,
  error = null,
}) {
  const jobId = id || `txjob-${randomUUID().slice(0, 12)}`;

  db.prepare(`
    INSERT INTO transcription_jobs (
      id, user_id, project_id, media_id, status, progress, current_stage,
      language, provider_type, duration, attempt, max_attempts, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    jobId, userId, projectId, mediaId, status, progress, currentStage,
    language, providerType, duration, attempt, maxAttempts, error,
  );

  return findJobById(jobId);
}

/**
 * Finds transcription job by ID
 */
export function findJobById(id) {
  if (!id) return null;
  return db.prepare('SELECT * FROM transcription_jobs WHERE id = ?').get(id);
}

/**
 * Finds transcription job by ID and verifies user ownership
 */
export function findJobByIdAndUser(id, userId) {
  if (!id || !userId) return null;
  return db.prepare('SELECT * FROM transcription_jobs WHERE id = ? AND user_id = ?').get(id, userId);
}

export function findLatestJobByProjectAndUser(projectId, userId) {
  if (!projectId || !userId) return null;
  return db.prepare(`
    SELECT * FROM transcription_jobs
    WHERE project_id = ? AND user_id = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT 1
  `).get(projectId, userId);
}

export function findActiveJobForSource(userId, projectId = null, mediaId = null) {
  if (!userId || (!projectId && !mediaId)) return null;
  const field = projectId ? 'project_id' : 'media_id';
  const value = projectId || mediaId;
  return db.prepare(`
    SELECT * FROM transcription_jobs
    WHERE user_id = ? AND ${field} = ? AND status IN ('queued', 'processing')
    ORDER BY created_at DESC, rowid DESC
    LIMIT 1
  `).get(userId, value);
}

/**
 * Updates status and metadata for a transcription job
 */
export function updateJobStatus(id, status, {
  error = undefined,
  duration = null,
  language = null,
  providerType = null,
  progress = null,
  currentStage = undefined,
  attempt = null,
  workerId = null,
} = {}) {
  if (!id) return false;

  const existing = findJobById(id);
  if (!existing) return false;

  const newError = error !== undefined ? error : existing.error;
  const newDuration = duration !== null && duration !== undefined ? duration : existing.duration;
  const newLanguage = language !== null && language !== undefined ? language : existing.language;
  const newProviderType = providerType !== null && providerType !== undefined ? providerType : existing.provider_type;
  const newProgress = progress !== null && progress !== undefined ? progress : existing.progress;
  const newCurrentStage = currentStage !== undefined ? currentStage : existing.current_stage;
  const newAttempt = attempt !== null && attempt !== undefined ? attempt : existing.attempt;
  const workerGuard = workerId ? ' AND lease_owner = ?' : '';
  const values = [
    status, newProgress, newCurrentStage, newError, newDuration,
    newLanguage, newProviderType, newAttempt, id,
  ];
  if (workerId) values.push(workerId);

  const result = db.prepare(`
    UPDATE transcription_jobs
    SET status = ?, progress = ?, current_stage = ?, error = ?, duration = ?,
        language = ?, provider_type = ?, attempt = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?${workerGuard}
  `).run(...values);

  return result.changes > 0;
}

export function claimTranscriptionJob(id, workerId, leaseMs) {
  const claim = db.transaction(() => {
    const job = findJobById(id);
    if (!job || !ACTIVE_STATUSES.includes(job.status)) return null;

    const now = Date.now();
    const leaseAvailable = !job.lease_owner || !job.lease_expires_at ||
      job.lease_expires_at <= now || job.lease_owner === workerId;
    if (!leaseAvailable) return null;

    const isRecovery = job.status !== 'queued' || Boolean(job.lease_owner && job.lease_owner !== workerId);
    if (isRecovery && job.attempt >= job.max_attempts) {
      db.prepare(`
        UPDATE transcription_jobs
        SET status = 'failed', progress = 0, current_stage = 'Recovery limit reached.',
            error = ?, lease_owner = NULL, lease_expires_at = NULL,
            last_heartbeat_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run('Transcription recovery limit has been reached.', id);
      return null;
    }

    db.prepare(`
      UPDATE transcription_jobs
      SET status = 'queued', progress = ?, current_stage = ?, attempt = ?,
          error = NULL, lease_owner = ?, lease_expires_at = ?,
          last_heartbeat_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      isRecovery ? 10 : job.progress,
      isRecovery ? 'Recovering interrupted transcription...' : job.current_stage,
      isRecovery ? job.attempt + 1 : job.attempt,
      workerId,
      now + leaseMs,
      now,
      id,
    );
    return findJobById(id);
  });
  return claim.immediate();
}

export function heartbeatTranscriptionJob(id, workerId, leaseMs) {
  const now = Date.now();
  const result = db.prepare(`
    UPDATE transcription_jobs
    SET lease_expires_at = ?, last_heartbeat_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND lease_owner = ? AND status IN ('queued', 'processing')
  `).run(now + leaseMs, now, id, workerId);
  return result.changes === 1;
}

export function releaseTranscriptionJob(id, workerId) {
  const result = db.prepare(`
    UPDATE transcription_jobs
    SET lease_owner = NULL, lease_expires_at = NULL, last_heartbeat_at = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND lease_owner = ?
  `).run(id, workerId);
  return result.changes === 1;
}

export function clearTranscriptionLease(id) {
  db.prepare(`
    UPDATE transcription_jobs
    SET lease_owner = NULL, lease_expires_at = NULL, last_heartbeat_at = NULL
    WHERE id = ?
  `).run(id);
}

export function findRecoverableTranscriptionJobs(limit = 20) {
  return db.prepare(`
    SELECT * FROM transcription_jobs
    WHERE status IN ('queued', 'processing')
      AND (lease_owner IS NULL OR lease_expires_at IS NULL OR lease_expires_at <= ?)
    ORDER BY created_at ASC
    LIMIT ?
  `).all(Date.now(), limit);
}

/**
 * Saves transcript segments atomically within a transaction
 */
export function saveTranscriptSegments(jobId, projectId = null, segments = []) {
  if (!jobId || !Array.isArray(segments) || segments.length === 0) return [];

  const insertStmt = db.prepare(`
    INSERT INTO transcript_segments (
      id, job_id, project_id, start_time, end_time, text, speaker, speaker_source, confidence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const deleteExisting = db.prepare('DELETE FROM transcript_segments WHERE job_id = ?');

  const insertMany = db.transaction((segs) => {
    deleteExisting.run(jobId);
    for (const s of segs) {
      const segId = s.id || `seg-${randomUUID().slice(0, 8)}`;
      const startTime = typeof s.start === 'number' ? s.start : (s.startTime || 0);
      const endTime = typeof s.end === 'number' ? s.end : (s.endTime || startTime + 2);
      const text = s.text || s.originalText || '';
      const speaker = s.speaker || null;
      const confidence = typeof s.confidence === 'number' ? s.confidence : 0.95;

      insertStmt.run(segId, jobId, projectId, startTime, endTime, text, speaker,
        s.speakerSource === 'diarization' ? 'diarization' : null, confidence);
    }
  });

  insertMany(segments);

  return findSegmentsByJobId(jobId);
}

/**
 * Retrieves all transcript segments for a given job
 */
export function findSegmentsByJobId(jobId) {
  if (!jobId) return [];
  return db.prepare('SELECT * FROM transcript_segments WHERE job_id = ? ORDER BY start_time ASC').all(jobId);
}

/**
 * Retrieves all transcript segments for a given project
 */
export function findSegmentsByProjectId(projectId) {
  if (!projectId) return [];
  return db.prepare('SELECT * FROM transcript_segments WHERE project_id = ? ORDER BY start_time ASC').all(projectId);
}
