import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { db } from '../db.js';

export const INVITE_ERRORS = Object.freeze({
  REQUIRED: 'INVITE_REQUIRED',
  INVALID: 'INVITE_INVALID',
  EXPIRED: 'INVITE_EXPIRED',
  EMAIL_MISMATCH: 'INVITE_EMAIL_MISMATCH',
});

export function isInviteRequired() {
  return String(process.env.BETA_INVITE_REQUIRED || '').toLowerCase() === 'true';
}

export function hashInviteToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function createInvite({ email, expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error('A valid email is required.');
  const token = randomBytes(32).toString('base64url');
  const id = `inv-${randomUUID()}`;
  db.prepare(`
    INSERT INTO beta_invites (id, email, token_hash, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(id, normalizedEmail, hashInviteToken(token), expiresAt);
  return { id, email: normalizedEmail, token, expiresAt };
}

export function validateInviteToken(token, email) {
  if (!isInviteRequired()) return { required: false, invite: null };
  if (typeof token !== 'string' || token.length < 32) return { error: INVITE_ERRORS.REQUIRED };
  const digest = hashInviteToken(token);
  const invite = db.prepare('SELECT * FROM beta_invites WHERE token_hash = ?').get(digest);
  if (!invite || invite.used_at) return { error: INVITE_ERRORS.INVALID };
  if (Date.now() > Number(invite.expires_at)) return { error: INVITE_ERRORS.EXPIRED };
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const left = Buffer.from(invite.email);
  const right = Buffer.from(normalizedEmail);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return { error: INVITE_ERRORS.EMAIL_MISMATCH };
  return { required: true, invite };
}

export function findActiveInviteByToken(token) {
  if (typeof token !== 'string' || token.length < 32) return { error: INVITE_ERRORS.REQUIRED };
  const invite = db.prepare('SELECT * FROM beta_invites WHERE token_hash = ?').get(hashInviteToken(token));
  if (!invite || invite.used_at) return { error: INVITE_ERRORS.INVALID };
  if (Date.now() > Number(invite.expires_at)) return { error: INVITE_ERRORS.EXPIRED };
  return { invite };
}

export function consumeInvite(inviteId, userId) {
  if (!inviteId) return !isInviteRequired();
  const result = db.prepare(`
    UPDATE beta_invites
    SET used_at = ?, used_by = ?
    WHERE id = ? AND used_at IS NULL AND expires_at >= ?
  `).run(Date.now(), userId, inviteId, Date.now());
  return result.changes === 1;
}

export function findInviteById(id) {
  return id ? db.prepare('SELECT * FROM beta_invites WHERE id = ?').get(id) : null;
}
