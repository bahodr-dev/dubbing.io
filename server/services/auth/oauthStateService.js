import crypto from 'crypto';
import { db } from '../../db.js';

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Generates base64url encoded random string
 */
export function generateRandomString(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Creates PKCE code challenge from verifier using SHA-256
 */
export function createPkceChallenge(codeVerifier) {
  return crypto.createHash('sha256').update(codeVerifier).digest('base64url');
}

/**
 * Creates and stores a secure OAuth state record
 */
export function createOAuthState({ provider, redirectUrl = '/dashboard', usePkce = false }) {
  const state = generateRandomString(32);
  const codeVerifier = usePkce ? generateRandomString(43) : null;
  const expiresAt = Date.now() + STATE_TTL_MS;

  // Cleanup expired states periodically
  try {
    db.prepare('DELETE FROM oauth_states WHERE expires_at < ?').run(Date.now());
  } catch (_) {}

  db.prepare(`
    INSERT INTO oauth_states (state, provider, code_verifier, redirect_url, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(state, provider, codeVerifier, redirectUrl, expiresAt);

  return {
    state,
    codeVerifier,
    codeChallenge: codeVerifier ? createPkceChallenge(codeVerifier) : null,
  };
}

/**
 * Validates and atomically consumes OAuth state to prevent replay attacks
 */
export function validateAndConsumeState(state, provider) {
  if (!state || typeof state !== 'string') {
    return { valid: false, error: 'Missing OAuth state parameter.' };
  }

  const record = db.prepare('SELECT * FROM oauth_states WHERE state = ?').get(state);

  if (!record) {
    return { valid: false, error: 'Invalid or already consumed OAuth state.' };
  }

  // Delete state immediately to prevent replay
  db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);

  if (record.provider !== provider) {
    return { valid: false, error: `OAuth provider mismatch (expected ${provider}, received ${record.provider}).` };
  }

  if (Date.now() > record.expires_at) {
    return { valid: false, error: 'OAuth state has expired. Please try signing in again.' };
  }

  return {
    valid: true,
    stateData: record,
  };
}
