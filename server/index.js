import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './db.js';
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';

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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging in development
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Dubbing.io API' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Dubbing.io Backend API running on http://localhost:${PORT}`);
});
