import { randomUUID } from 'crypto';
import { db } from '../db.js';

export function createPasswordResetToken({ userId, tokenHash, expiresAt }) {
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE password_reset_tokens
      SET used_at = ?
      WHERE user_id = ? AND used_at IS NULL
    `).run(Date.now(), userId);
    db.prepare(`
      INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(`reset-${randomUUID()}`, userId, tokenHash, expiresAt);
  });
  transaction();
}

export function deleteByTokenHash(tokenHash) {
  db.prepare('DELETE FROM password_reset_tokens WHERE token_hash = ?').run(tokenHash);
}

export function consumePasswordResetToken({ tokenHash, passwordHash }) {
  const transaction = db.transaction(() => {
    const reset = db.prepare(`
      SELECT id, user_id, expires_at, used_at
      FROM password_reset_tokens
      WHERE token_hash = ?
    `).get(tokenHash);

    if (!reset || reset.used_at || reset.expires_at <= Date.now()) return null;

    const usedAt = Date.now();
    const claimed = db.prepare(`
      UPDATE password_reset_tokens
      SET used_at = ?
      WHERE id = ? AND used_at IS NULL AND expires_at > ?
    `).run(usedAt, reset.id, usedAt);
    if (claimed.changes !== 1) return null;

    db.prepare(`
      UPDATE users
      SET password_hash = ?, auth_version = auth_version + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(passwordHash, reset.user_id);
    db.prepare(`
      UPDATE password_reset_tokens
      SET used_at = ?
      WHERE user_id = ? AND used_at IS NULL
    `).run(usedAt, reset.user_id);
    return reset.user_id;
  });

  return transaction();
}

export function removeExpiredPasswordResetTokens() {
  db.prepare('DELETE FROM password_reset_tokens WHERE expires_at <= ? OR used_at IS NOT NULL').run(Date.now());
}
