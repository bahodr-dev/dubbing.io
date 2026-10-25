import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { db, getDatabaseMigrationStatus, initDatabase, uploadsDir } from '../db.js';
import { validateProductionConfig } from '../config/production.js';

const checks = [];
const check = (name, fn) => {
  try {
    const detail = fn();
    checks.push({ name, status: 'ok', ...(detail ? { detail } : {}) });
  } catch (error) {
    checks.push({ name, status: 'failed', detail: error.message });
  }
};

check('production configuration', () => validateProductionConfig({ ...process.env, NODE_ENV: 'production' }));
check('ffmpeg binary', () => {
  const result = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-version'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('FFmpeg is unavailable.');
  return result.stdout.split('\n')[0];
});
check('ffprobe binary', () => {
  const result = spawnSync(process.env.FFPROBE_PATH || 'ffprobe', ['-version'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('FFprobe is unavailable.');
  return result.stdout.split('\n')[0];
});
check('database migrations', () => {
  initDatabase();
  const status = getDatabaseMigrationStatus();
  if (status.pending.length) throw new Error(`Pending migrations: ${status.pending.join(', ')}`);
  const integrity = db.pragma('integrity_check', { simple: true });
  if (integrity !== 'ok') throw new Error(`SQLite integrity check failed: ${integrity}`);
  return status.currentVersion;
});
check('persistent media directory', () => {
  fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o700 });
  fs.accessSync(uploadsDir, fs.constants.R_OK | fs.constants.W_OK);
  const stat = fs.statfsSync(uploadsDir);
  const usedPercent = Math.round((1 - stat.bavail / stat.blocks) * 1000) / 10;
  const critical = Number(process.env.DISK_CRITICAL_PERCENT || 85);
  if (usedPercent >= critical) throw new Error(`Disk usage is critical (${usedPercent}%).`);
  return `${path.resolve(uploadsDir)} (${usedPercent}% disk used)`;
});

const failed = checks.filter((item) => item.status === 'failed');
console.log(JSON.stringify({ ready: failed.length === 0, checks }, null, 2));
if (failed.length) process.exitCode = 1;
