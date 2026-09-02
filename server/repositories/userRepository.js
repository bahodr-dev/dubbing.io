import { randomUUID } from 'crypto';
import { db } from '../db.js';

export function findById(id) {
  if (!id) return null;
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
}

export function findByEmail(email) {
  if (!email) return null;
  const cleanEmail = email.trim().toLowerCase();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail) || null;
}

export function createUser({
  id = randomUUID(),
  email,
  name,
  passwordHash = null,
  avatarUrl = '',
  provider = 'email',
}) {
  const cleanEmail = email.trim().toLowerCase();
  const displayName = name ? name.trim() : cleanEmail.split('@')[0];

  db.prepare(`
    INSERT INTO users (id, email, name, password_hash, avatar_url, provider)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, cleanEmail, displayName, passwordHash, avatarUrl || '', provider);

  return findById(id);
}

export function updateUser(id, updates = {}) {
  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.avatarUrl !== undefined) {
    fields.push('avatar_url = ?');
    values.push(updates.avatarUrl);
  }
  if (updates.passwordHash !== undefined) {
    fields.push('password_hash = ?');
    values.push(updates.passwordHash);
  }
  if (updates.plan !== undefined) {
    fields.push('plan = ?');
    values.push(updates.plan);
  }
  if (updates.minutesBalance !== undefined) {
    fields.push('minutes_balance = ?');
    values.push(updates.minutesBalance);
  }
  if (updates.subscriptionExpiresAt !== undefined) {
    fields.push('subscription_expires_at = ?');
    values.push(updates.subscriptionExpiresAt);
  }

  if (fields.length === 0) return findById(id);

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  db.prepare(`
    UPDATE users
    SET ${fields.join(', ')}
    WHERE id = ?
  `).run(...values);

  return findById(id);
}

export function creditSubscription(userId, { plan = 'creator', minutesToAdd = 60, durationDays = 30 }) {
  const user = findById(userId);
  if (!user) return null;

  const currentBalance = typeof user.minutes_balance === 'number' ? user.minutes_balance : 5.0;
  const newBalance = currentBalance + minutesToAdd;

  const expiresDate = new Date();
  expiresDate.setDate(expiresDate.getDate() + durationDays);

  db.prepare(`
    UPDATE users
    SET plan = ?,
        minutes_balance = ?,
        subscription_expires_at = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(plan, newBalance, expiresDate.toISOString(), userId);

  return findById(userId);
}

export function formatUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email.split('@')[0],
    provider: user.provider || 'email',
    avatarUrl: user.avatar_url || '',
    plan: user.plan || 'free',
    minutesBalance: typeof user.minutes_balance === 'number' ? user.minutes_balance : 5.0,
    subscriptionExpiresAt: user.subscription_expires_at || null,
    createdAt: user.created_at,
  };
}
