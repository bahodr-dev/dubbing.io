import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getJwtSecret, COOKIE_NAME } from '../services/auth/sessionService.js';

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

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. No session token provided.',
    });
  }

  try {
    const user = jwt.verify(token, getJwtSecret());
    req.user = user;
    next();
  } catch (_) {
    return res.status(403).json({
      error: 'Invalid or expired authentication token. Please sign in again.',
    });
  }
}
