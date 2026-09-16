import { randomUUID } from 'crypto';
import { db } from '../db.js';

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
    speaker: s.speaker || 'Speaker 1',
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
    progress: job.status === 'completed' ? 100 : (job.status === 'processing' ? 50 : 10),
    language: job.language || 'en',
    duration: parsedDuration,
    error: job.error || null,
    segments: formattedSegments,
    result: job.status === 'completed' ? {
      segments: formattedSegments,
      segmentCount: formattedSegments.length,
      language: job.language || 'en',
      duration: parsedDuration ?? 0,
    } : null,
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
  error = null,
}) {
  const jobId = id || `txjob-${randomUUID().slice(0, 12)}`;

  db.prepare(`
    INSERT INTO transcription_jobs (
      id, user_id, project_id, media_id, status, language, duration, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(jobId, userId, projectId, mediaId, status, language, duration, error);

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

/**
 * Updates status and metadata for a transcription job
 */
export function updateJobStatus(id, status, { error = null, duration = null, language = null } = {}) {
  if (!id) return false;

  const existing = findJobById(id);
  if (!existing) return false;

  const newError = error !== undefined ? error : existing.error;
  const newDuration = duration !== null && duration !== undefined ? duration : existing.duration;
  const newLanguage = language !== null && language !== undefined ? language : existing.language;

  const result = db.prepare(`
    UPDATE transcription_jobs
    SET status = ?, error = ?, duration = ?, language = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, newError, newDuration, newLanguage, id);

  return result.changes > 0;
}

/**
 * Saves transcript segments atomically within a transaction
 */
export function saveTranscriptSegments(jobId, projectId = null, segments = []) {
  if (!jobId || !Array.isArray(segments) || segments.length === 0) return [];

  const insertStmt = db.prepare(`
    INSERT INTO transcript_segments (
      id, job_id, project_id, start_time, end_time, text, speaker, confidence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const deleteExisting = db.prepare('DELETE FROM transcript_segments WHERE job_id = ?');

  const insertMany = db.transaction((segs) => {
    deleteExisting.run(jobId);
    for (const s of segs) {
      const segId = s.id || `seg-${randomUUID().slice(0, 8)}`;
      const startTime = typeof s.start === 'number' ? s.start : (s.startTime || 0);
      const endTime = typeof s.end === 'number' ? s.end : (s.endTime || startTime + 2);
      const text = s.text || s.originalText || '';
      const speaker = s.speaker || 'Speaker 1';
      const confidence = typeof s.confidence === 'number' ? s.confidence : 0.95;

      insertStmt.run(segId, jobId, projectId, startTime, endTime, text, speaker, confidence);
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
