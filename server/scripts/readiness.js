import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import Database from 'better-sqlite3';
import request from 'supertest';

const root = path.resolve(import.meta.dirname, '../..');
const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'dubla-readiness-'));
const dbPath = path.join(runtime, 'database', 'dubbing.db');
const uploadsDir = path.join(runtime, 'media');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

function run(label, command, args, env = {}) {
  console.log(`\n[readiness] ${label}`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error(`${label} failed.`);
}

const rehearsalEnv = {
  NODE_ENV: 'production',
  APP_URL: 'https://staging.dubla.uz',
  PORT: '5000',
  DUBBING_DB_PATH: dbPath,
  DUBBING_UPLOADS_DIR: uploadsDir,
  BETA_INVITE_REQUIRED: 'true',
  JWT_SECRET: 'readiness-only-secret-with-more-than-32-characters',
  OPENAI_API_KEY: 'readiness-openai-key',
  TRANSLATION_PROVIDER: 'openai',
  TRANSCRIPTION_PROVIDER: 'openai',
  FILM_IDENTITY_PROVIDER: 'gemini',
  FILM_SEPARATION_PROVIDER: 'fal',
  TTS_PROVIDER: 'auto',
  ELEVENLABS_API_KEY: 'readiness-elevenlabs-key',
  PAYME_MERCHANT_ID: 'readiness-payme-merchant',
  PAYME_SECRET_KEY: 'readiness-payme-secret',
  PAYME_TEST_MODE: 'false',
  CLICK_SERVICE_ID: 'readiness-click-service',
  CLICK_MERCHANT_ID: 'readiness-click-merchant',
  CLICK_SECRET_KEY: 'readiness-click-secret',
  CLICK_TEST_MODE: 'false',
  SENTRY_DSN: 'https://public@example.invalid/1',
  APP_RELEASE: 'readiness-local',
};

try {
  run('lint', 'npm', ['run', 'lint']);
  run('automated tests', 'npm', ['test'], {
    NODE_ENV: 'test',
    BETA_INVITE_REQUIRED: 'false',
    PAYME_TEST_MODE: 'true',
    CLICK_TEST_MODE: 'true',
  });
  run('production build', 'npm', ['run', 'build']);
  run('migration rehearsal', 'npm', ['run', 'migrate:db'], rehearsalEnv);
  run('production preflight', 'npm', ['run', 'preflight'], rehearsalEnv);

  console.log('\n[readiness] production application and health endpoint');
  Object.assign(process.env, rehearsalEnv);
  const { app } = await import('../app.js');
  const healthResponse = await request(app).get('/api/health');
  if (healthResponse.status !== 200 || healthResponse.body.status !== 'ok') {
    throw new Error(`Health check failed: ${healthResponse.status} ${JSON.stringify(healthResponse.body)}`);
  }
  console.log(`[readiness] health ok, schema ${healthResponse.body.database.schemaVersion}`);
  const { db } = await import('../db.js');
  db.close();

  run('database backup', 'npm', ['run', 'backup:db'], rehearsalEnv);
  const backups = fs.readdirSync(path.join(runtime, 'database', 'backups')).filter((name) => name.endsWith('.db'));
  if (backups.length !== 1) throw new Error('Backup rehearsal did not create exactly one snapshot.');
  const restored = new Database(path.join(runtime, 'database', 'backups', backups[0]), { readonly: true });
  const integrity = restored.pragma('integrity_check', { simple: true });
  restored.close();
  if (integrity !== 'ok') throw new Error(`Restored backup integrity failed: ${integrity}`);

  console.log('\n[readiness] READY — local production rehearsal passed.');
} finally {
  fs.rmSync(runtime, { recursive: true, force: true });
}
