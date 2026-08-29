import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const COOKIE_NAME = 'dubbing_session';
export const TOKEN_EXPIRES_IN = '30d';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      return 'test_jwt_secret_vitest_secure_key_1234567890';
    }
    throw new Error('FATAL SECURITY ERROR: process.env.JWT_SECRET is missing. Server cannot sign session tokens.');
  }
  return secret;
}

/**
 * Signs a standard JWT access token for the given user
 */
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name || user.email.split('@')[0],
    },
    getJwtSecret(),
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

/**
 * Sets secure HTTP-only session cookie on the Express response
 */
export function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/',
  });
}

/**
 * Clears session cookie on the Express response
 */
export function clearAuthCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * Extracts and verifies JWT from cookie or Authorization header
 */
export function verifySessionToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
  } catch (_) {
    return null;
  }
}
