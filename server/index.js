import { app } from './app.js';
import { JobManager } from './services/jobQueue.js';
import { validateProductionConfig } from './config/production.js';

validateProductionConfig();

const PORT = process.env.PORT || 5000;
let shuttingDown = false;

// Start Server and resume any jobs interrupted by a previous process exit.
const server = app.listen(PORT, () => {
  console.log(`🚀 dubla.uz Backend API running on http://localhost:${PORT}`);
  JobManager.startWorker();
});

const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Server] ${signal} received, stopping new work...`);
  JobManager.stopWorker();
  server.close(() => process.exit(0));
};

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
