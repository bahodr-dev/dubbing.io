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

export function formatUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email.split('@')[0],
    provider: user.provider || 'email',
    avatarUrl: user.avatar_url || '',
    createdAt: user.created_at,
  };
}
