import rateLimit from 'express-rate-limit';

// General API rate limiter (300 requests per 15 mins)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  skip: req => req.method === 'GET' && /^\/(dubbing|films)\//.test(req.path),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP address, please try again after 15 minutes.',
  },
});

// Authentication rate limiter for brute-force defense (20 requests per 15 mins)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

// Media upload rate limiter to prevent disk-flooding attacks (30 uploads per 15 mins)
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Upload rate limit exceeded. Please wait a few minutes before uploading more files.',
  },
});

// Apply after authentication: shared studio NATs get independent user quotas.
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  keyGenerator: req => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI request quota reached. Try again later.', code: 'AI_QUOTA_REACHED' },
});
export const pollingLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  keyGenerator: req => req.user.id,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Polling too frequently. Wait before refreshing.' },
});
