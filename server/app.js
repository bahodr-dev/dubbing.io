import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { initDatabase } from './db.js';
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { mediaRouter } from './routes/media.js';
import { voicesRouter } from './routes/voices.js';
import { dubbingRouter } from './routes/dubbing.js';
import { paymentsRouter } from './routes/payments.js';
import { apiLimiter, authLimiter, uploadLimiter } from './middleware/rateLimiter.js';

dotenv.config();

export const app = express();

// Initialize Database
initDatabase();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];
if (process.env.APP_URL && !allowedOrigins.includes(process.env.APP_URL)) {
  allowedOrigins.push(process.env.APP_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS blocked: Origin not allowed.'));
    }
  },
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Apply General Rate Limiter to all /api routes in production
if (process.env.NODE_ENV !== 'test') {
  app.use('/api', apiLimiter);
}

// Request logging in development
if (process.env.NODE_ENV !== 'test') {
  app.use((req, _res, next) => {
    console.log(`[API] ${req.method} ${req.path}`);
    next();
  });
}

// API Routes
app.use('/api/auth', process.env.NODE_ENV === 'test' ? authRouter : [authLimiter, authRouter]);
app.use('/api/projects', projectsRouter);
app.use('/api/media', process.env.NODE_ENV === 'test' ? mediaRouter : [uploadLimiter, mediaRouter]);
app.use('/api/voices', voicesRouter);
app.use('/api/dubbing', dubbingRouter);
app.use('/api/payments', paymentsRouter);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Dubbing.io API' });
});
