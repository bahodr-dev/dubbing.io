import { randomUUID } from 'crypto';
import { db } from '../db.js';

export function findByProviderAccount(provider, providerAccountId) {
  if (!provider || !providerAccountId) return null;
  return (
    db
      .prepare('SELECT * FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?')
      .get(provider, String(providerAccountId)) || null
  );
}

export function findByUserId(userId) {
  if (!userId) return [];
  return db.prepare('SELECT * FROM oauth_accounts WHERE user_id = ?').all(userId);
}

export function createOAuthAccount({
  id = randomUUID(),
  userId,
  provider,
  providerAccountId,
  providerEmail = null,
}) {
  db.prepare(`
    INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, provider_email)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, userId, provider, String(providerAccountId), providerEmail ? providerEmail.toLowerCase() : null);

  return (
    db.prepare('SELECT * FROM oauth_accounts WHERE id = ?').get(id) || null
  );
}
