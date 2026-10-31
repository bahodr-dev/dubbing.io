import { randomUUID } from 'crypto';
import { db } from '../db.js';

function normalizeMinutes(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.round(minutes * 1_000_000) / 1_000_000;
}

function performReservation({ userId, projectId = null, jobId, minutes }) {
  const normalizedMinutes = normalizeMinutes(minutes);
  if (!userId || !jobId || !normalizedMinutes) {
    return { ok: false, reason: 'INVALID_RESERVATION', balance: null };
  }

  const existing = db.prepare('SELECT * FROM minute_usage WHERE job_id = ?').get(jobId);
  const user = db.prepare('SELECT minutes_balance FROM users WHERE id = ?').get(userId);
  if (!user) return { ok: false, reason: 'USER_NOT_FOUND', balance: null };

  const balance = Number(user.minutes_balance || 0);
  if (existing?.status === 'reserved' || existing?.status === 'consumed') {
    return { ok: true, reservation: existing, balance };
  }

  const deduction = db.prepare(`
    UPDATE users
    SET minutes_balance = MAX(0, ROUND(minutes_balance - ?, 6)), updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND ROUND(minutes_balance, 6) >= ?
  `).run(normalizedMinutes, userId, normalizedMinutes);

  if (deduction.changes !== 1) {
    return { ok: false, reason: 'INSUFFICIENT_MINUTES', balance };
  }

  const updatedUser = db.prepare('SELECT minutes_balance FROM users WHERE id = ?').get(userId);
  const balanceAfter = Math.max(0, Number(updatedUser.minutes_balance || 0));

  if (existing?.status === 'refunded') {
    db.prepare(`
      UPDATE minute_usage
      SET status = 'reserved', minutes = ?, balance_after_reservation = ?,
          failure_reason = NULL, reserved_at = CURRENT_TIMESTAMP,
          consumed_at = NULL, refunded_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ? AND user_id = ? AND status = 'refunded'
    `).run(normalizedMinutes, balanceAfter, jobId, userId);
  } else {
    db.prepare(`
      INSERT INTO minute_usage (
        id, user_id, project_id, job_id, minutes, status, balance_after_reservation
      ) VALUES (?, ?, ?, ?, ?, 'reserved', ?)
    `).run(`usage-${randomUUID().slice(0, 12)}`, userId, projectId, jobId, normalizedMinutes, balanceAfter);
  }

  return {
    ok: true,
    reservation: db.prepare('SELECT * FROM minute_usage WHERE job_id = ?').get(jobId),
    balance: balanceAfter,
  };
}

export function reserveMinutesForJobInTransaction(input) {
  return performReservation(input);
}

export function reserveMinutesForJob(input) {
  const reserve = db.transaction(() => performReservation(input));
  return reserve.immediate();
}

export function consumeMinutesForJob(jobId) {
  const result = db.prepare(`
    UPDATE minute_usage
    SET status = 'consumed', consumed_at = CURRENT_TIMESTAMP,
        failure_reason = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE job_id = ? AND status = 'reserved'
  `).run(jobId);
  if (result.changes === 1) return true;
  return db.prepare(`SELECT status FROM minute_usage WHERE job_id = ?`).get(jobId)?.status === 'consumed';
}

export function refundMinutesForJob(jobId, failureReason = null) {
  const refund = db.transaction(() => {
    const usage = db.prepare(`SELECT * FROM minute_usage WHERE job_id = ?`).get(jobId);
    if (!usage) return false;
    if (usage.status === 'refunded') return true;
    if (usage.status !== 'reserved') return false;

    const transition = db.prepare(`
      UPDATE minute_usage
      SET status = 'refunded', refunded_at = CURRENT_TIMESTAMP,
          failure_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE job_id = ? AND status = 'reserved'
    `).run(failureReason, jobId);
    if (transition.changes !== 1) return false;

    db.prepare(`
      UPDATE users
      SET minutes_balance = ROUND(minutes_balance + ?, 6), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(usage.minutes, usage.user_id);
    return true;
  });
  return refund.immediate();
}

export function reconcileTerminalJobs() {
  const rows = db.prepare(`
    SELECT usage.job_id, jobs.status, jobs.error
    FROM minute_usage AS usage
    JOIN dubbing_jobs AS jobs ON jobs.id = usage.job_id
    WHERE usage.status = 'reserved' AND jobs.status IN ('completed', 'partial', 'failed')
  `).all();

  let consumed = 0;
  let refunded = 0;
  for (const row of rows) {
    if (['completed', 'partial'].includes(row.status) && consumeMinutesForJob(row.job_id)) consumed += 1;
    if (row.status === 'failed' && refundMinutesForJob(row.job_id, row.error)) refunded += 1;
  }
  return { consumed, refunded };
}

export function findRecentUsageByUser(userId, limit = 25) {
  const safeLimit = Math.max(1, Math.min(100, Number.parseInt(limit, 10) || 25));
  return db.prepare(`
    SELECT id, project_id, job_id, minutes, status, failure_reason,
           reserved_at, consumed_at, refunded_at, updated_at
    FROM minute_usage
    WHERE user_id = ?
    ORDER BY reserved_at DESC, rowid DESC
    LIMIT ?
  `).all(userId, safeLimit);
}
