import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { initDatabase, uploadsDir } from './db.js';
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { mediaRouter } from './routes/media.js';
import { voicesRouter } from './routes/voices.js';
import { dubbingRouter } from './routes/dubbing.js';
import { apiLimiter, authLimiter, uploadLimiter } from './middleware/rateLimiter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database
initDatabase();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Apply General Rate Limiter to all /api routes
app.use('/api', apiLimiter);

// Serve Uploaded Media Files Statically
app.use('/uploads', express.static(uploadsDir));

// Request logging in development
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// API Routes with specific rate limiters where appropriate
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/media', uploadLimiter, mediaRouter);
app.use('/api/voices', voicesRouter);
app.use('/api/dubbing', dubbingRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Dubbing.io API' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Dubbing.io Backend API running on http://localhost:${PORT}`);
});
