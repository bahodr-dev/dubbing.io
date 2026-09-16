/**
 * Structured, security-sanitized logger for Dubbing.io pipeline
 */

const SENSITIVE_KEYS = new Set([
  'apikey', 'api_key', 'authorization', 'cookie', 'cookies',
  'password', 'secret', 'jwt_secret', 'token', 'access_token'
]);

/**
 * Recursively sanitizes an object to redact sensitive properties
 */
export function sanitizeLogData(data, depth = 0) {
  if (depth > 5 || data === null || data === undefined) return data;

  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      // Redact Bearer tokens or long hex/base64 strings if formatted like keys
      return data.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
                 .replace(/sk-[A-Za-z0-9]{20,}/gi, 'sk-[REDACTED]');
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('password') || lowerKey.includes('token')) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeLogData(value, depth + 1);
    }
  }
  return sanitized;
}

/**
 * Logs a structured event with timestamp and sanitized metadata
 */
export function logEvent(eventName, payload = {}) {
  const timestamp = new Date().toISOString();
  const sanitized = sanitizeLogData(payload);

  if (process.env.NODE_ENV !== 'test' || process.env.DEBUG_TESTS === 'true') {
    console.log(JSON.stringify({
      timestamp,
      event: eventName,
      ...sanitized,
    }));
  }
}

export const logger = {
  info: (msg, meta) => logEvent('info', { message: msg, ...meta }),
  warn: (msg, meta) => logEvent('warn', { message: msg, ...meta }),
  error: (msg, meta) => logEvent('error', { message: msg, ...meta }),
  event: logEvent,
};
