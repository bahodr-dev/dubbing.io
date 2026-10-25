import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getJwtSecret, COOKIE_NAME } from '../services/auth/sessionService.js';
import { db } from '../db.js';

dotenv.config();

/**
 * Authentication Middleware
 * Validates session JWT token from HTTP-only cookie or Authorization Bearer header
 */
export function authenticateToken(req, res, next) {
  let token = null;

  // 1. Check HTTP-only session cookie
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    token = req.cookies[COOKIE_NAME];
  }

  // 2. Fallback to Authorization Bearer header
  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  // 3. Fallback to query parameter (useful for HTML5 <video> / <img> / <a> tags)
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. No session token provided.',
    });
  }

  try {
    const user = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    const account = db.prepare('SELECT auth_version FROM users WHERE id = ?').get(user.id);
    if (!account || Number(user.authVersion || 0) !== Number(account.auth_version || 0)) {
      return res.status(403).json({
        error: 'This session is no longer valid. Please sign in again.',
      });
    }
    req.user = user;
    next();
  } catch (_) {
    return res.status(403).json({
      error: 'Invalid or expired authentication token. Please sign in again.',
    });
  }
}

/**
 * Attaches a verified user when available without making a public endpoint
 * require a session. This is useful for a shared catalog with private rows.
 */
export function authenticateOptional(req, _res, next) {
  let token = req.cookies?.[COOKIE_NAME] || null;
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) token = authHeader.slice(7);
  }
  if (!token) return next();

  try {
    const user = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    const account = db.prepare('SELECT auth_version FROM users WHERE id = ?').get(user.id);
    if (account && Number(user.authVersion || 0) === Number(account.auth_version || 0)) {
      req.user = user;
    }
  } catch (_) {
    // Public catalog access remains available with an expired or malformed
    // optional session; protected routes use authenticateToken instead.
  }
  next();
}
