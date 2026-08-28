import rateLimit from 'express-rate-limit';

// General API rate limiter (300 requests per 15 mins)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
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
