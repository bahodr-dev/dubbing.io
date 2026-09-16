import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { app } from '../app.js';
import { db } from '../db.js';
import * as transcriptionRepo from '../repositories/transcriptionRepository.js';
import { JobManager } from '../services/jobQueue.js';

describe('Real Video Transcription API & Duration Integration Tests (/api/dubbing)', () => {
  const tempDir = path.join(os.tmpdir(), `test_tx_media_${Date.now()}`);
  let userACookie = '';
  let userBCookie = '';
  let userAId = '';
  let _userBId = '';
  let userAProjectId = '';
  let userAMedia10sId = '';
  let userAMedia35sId = '';
  let userACorruptMediaId = '';

  beforeAll(async () => {
    fs.mkdirSync(tempDir, { recursive: true });

    // 1. Sign up User A
    const resA = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `tx_user_a_${Date.now()}@dubbing.io`,
        password: 'Password123!',
        name: 'User A Transcription',
      });
    const cookiesA = resA.headers['set-cookie'] || [];
    userACookie = cookiesA.find((c) => c.includes('dubbing_session='));
    userAId = resA.body.user.id;

    // 2. Sign up User B
    const resB = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `tx_user_b_${Date.now()}@dubbing.io`,
        password: 'Password123!',
        name: 'User B Attacker',
      });
    const cookiesB = resB.headers['set-cookie'] || [];
    userBCookie = cookiesB.find((c) => c.includes('dubbing_session='));
    _userBId = resB.body.user.id;

    // 3. User A creates a project
    const projRes = await request(app)
      .post('/api/projects')
      .set('Cookie', userACookie)
      .send({
        title: 'User A Transcription Project',
      });
    userAProjectId = projRes.body.project.id;

    // 4. Generate synthetic real media files with FFmpeg
    const media10sPath = path.join(tempDir, 'synth_10s.mp4');
    const media35sPath = path.join(tempDir, 'synth_35s.mp4');

    spawnSync('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=10',
      '-c:a', 'aac',
      media10sPath,
    ], { stdio: 'ignore' });

    spawnSync('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=35',
      '-c:a', 'aac',
      media35sPath,
    ], { stdio: 'ignore' });

    // 5. Upload 10s valid media
    const upload10sRes = await request(app)
      .post('/api/media/upload')
      .set('Cookie', userACookie)
      .attach('file', media10sPath);
    userAMedia10sId = upload10sRes.body.id;

    // 6. Upload 35s valid media
    const upload35sRes = await request(app)
      .post('/api/media/upload')
      .set('Cookie', userACookie)
      .attach('file', media35sPath);
    userAMedia35sId = upload35sRes.body.id;

    // 7. Upload corrupt non-media file
    const corruptBuffer = Buffer.from('FAKE_CORRUPT_VIDEO_STREAM_TEST_123');
    const uploadCorruptRes = await request(app)
      .post('/api/media/upload')
      .set('Cookie', userACookie)
      .attach('file', corruptBuffer, 'corrupt_sample.mp4');
    userACorruptMediaId = uploadCorruptRes.body.id;
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  async function pollJob(jobId, cookie, maxAttempts = 35) {
    let attempts = 0;
    while (attempts < maxAttempts) {
      const res = await request(app)
        .get(`/api/dubbing/transcribe/jobs/${jobId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      if (res.body.status === 'completed' || res.body.status === 'failed') {
        return res.body;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    throw new Error(`Job ${jobId} did not complete or fail within poll window`);
  }

  it('1. Rejects unauthenticated request to POST /api/dubbing/transcribe with 401', async () => {
    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .send({ duration: 30 });

    expect(res.status).toBe(401);
  });

  it('2. Rejects request from User B attempting to transcribe User A media (returns 404)', async () => {
    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userBCookie)
      .send({
        mediaId: userAMedia10sId,
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/media not found or unauthorized/i);
  });

  it('3. Rejects request from User B attempting to transcribe into User A project (returns 404)', async () => {
    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userBCookie)
      .send({
        projectId: userAProjectId,
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/project not found or unauthorized/i);
  });

  it('4. Test F — Endpoint is asynchronous and returns HTTP 202 immediately without blocking', async () => {
    const startTime = Date.now();
    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userACookie)
      .send({
        mediaId: userAMedia10sId,
        projectId: userAProjectId,
        duration: 30,
        providerType: 'mock',
      });

    const elapsed = Date.now() - startTime;
    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty('jobId');
    expect(res.body.jobId).toMatch(/^txjob-/);
    expect(['queued', 'processing']).toContain(res.body.status);
    expect(res.body).not.toHaveProperty('segments'); // Proves no synchronous transcription
    expect(elapsed).toBeLessThan(1000); // Proves request returned immediately
  });

  it('5. Test A — Real media duration (~10s) overrides client duration (30s)', async () => {
    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userACookie)
      .send({
        mediaId: userAMedia10sId,
        projectId: userAProjectId,
        duration: 30, // Client claimed 30s, but real media is 10s
        providerType: 'mock',
      });

    expect(res.status).toBe(202);
    const jobId = res.body.jobId;

    const jobData = await pollJob(jobId, userACookie);
    expect(jobData.status).toBe('completed');
    expect(jobData.progress).toBe(100);
    expect(jobData.result).toBeDefined();

    // Actual probed duration should be ~10 seconds and NOT the client provided 30s
    expect(jobData.result.duration).toBeGreaterThanOrEqual(9.9);
    expect(jobData.result.duration).toBeLessThanOrEqual(10.2);
    expect(jobData.result.duration).not.toBe(30);

    // Verify DB record
    const dbJob = transcriptionRepo.findJobById(jobId);
    expect(dbJob.duration).toBeGreaterThanOrEqual(9.9);
    expect(dbJob.duration).toBeLessThanOrEqual(10.2);
  });

  it('6. Test B — Absurd client duration (999999) is ignored for real media', async () => {
    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userACookie)
      .send({
        mediaId: userAMedia10sId,
        projectId: userAProjectId,
        duration: 999999, // Absurd client value
        providerType: 'mock',
      });

    expect(res.status).toBe(202);
    const jobId = res.body.jobId;

    const jobData = await pollJob(jobId, userACookie);
    expect(jobData.status).toBe('completed');
    expect(jobData.result.duration).toBeGreaterThanOrEqual(9.9);
    expect(jobData.result.duration).toBeLessThanOrEqual(10.2);
    expect(jobData.result.duration).not.toBe(999999);
  });

  it('7. Test C — Real media without client duration detects actual duration (no 30s fallback)', async () => {
    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userACookie)
      .send({
        mediaId: userAMedia10sId,
        projectId: userAProjectId,
        // No duration supplied in payload
        providerType: 'mock',
      });

    expect(res.status).toBe(202);
    const jobId = res.body.jobId;

    const jobData = await pollJob(jobId, userACookie);
    expect(jobData.status).toBe('completed');
    expect(jobData.result.duration).toBeGreaterThanOrEqual(9.9);
    expect(jobData.result.duration).toBeLessThanOrEqual(10.2);
    expect(jobData.result.duration).not.toBe(30);
  });

  it('8. Test D — Duration detection failure on corrupt media results in failed job with safe error', async () => {
    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userACookie)
      .send({
        mediaId: userACorruptMediaId,
        projectId: userAProjectId,
        duration: 30, // Client duration must NOT cause fake success
        providerType: 'mock',
      });

    expect(res.status).toBe(202);
    const jobId = res.body.jobId;

    const jobData = await pollJob(jobId, userACookie);
    expect(jobData.status).toBe('failed');
    expect(jobData).not.toHaveProperty('result');
    expect(jobData.error).toMatch(/Unable to determine media duration|Media validation failed/i);

    // Must not expose absolute paths or stack traces
    expect(jobData.error).not.toContain('/home/');
    expect(jobData.error).not.toContain('/run/media');
  });

  it('9. Test E — Mock provider remains functional with explicit duration when no real media is involved', async () => {
    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userACookie)
      .send({
        duration: 25,
        language: 'en',
        providerType: 'mock',
        // No mediaId or mediaPath provided
      });

    expect(res.status).toBe(202);
    const jobId = res.body.jobId;

    const jobData = await pollJob(jobId, userACookie);
    expect(jobData.status).toBe('completed');
    expect(jobData.result.duration).toBe(25);
    expect(jobData.result.segments.length).toBeGreaterThan(0);
  });

  it('10. Test G — Long media duration (>30s) is accurately detected', async () => {
    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userACookie)
      .send({
        mediaId: userAMedia35sId,
        projectId: userAProjectId,
        duration: 30, // Request claims 30, real media is 35
        providerType: 'mock',
      });

    expect(res.status).toBe(202);
    const jobId = res.body.jobId;

    const jobData = await pollJob(jobId, userACookie);
    expect(jobData.status).toBe('completed');
    expect(jobData.result.duration).toBeGreaterThanOrEqual(34.8);
    expect(jobData.result.duration).toBeLessThanOrEqual(35.3);
    expect(jobData.result.duration).toBeGreaterThan(30);

    // Verify project record in DB received the updated real duration
    const proj = db.prepare('SELECT duration, segments_json FROM projects WHERE id = ?').get(userAProjectId);
    expect(proj.duration).toBeGreaterThanOrEqual(34.8);
    expect(proj.duration).toBeLessThanOrEqual(35.3);
  });

  it('11. Ownership isolation — User B cannot retrieve User A transcription job', async () => {
    // Create a job for User A
    const resA = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userACookie)
      .send({
        duration: 20,
        providerType: 'mock',
      });

    const jobId = resA.body.jobId;

    // User B attempts to access User A's job
    const resB = await request(app)
      .get(`/api/dubbing/transcribe/jobs/${jobId}`)
      .set('Cookie', userBCookie);

    expect(resB.status).toBe(404);
    expect(resB.body.error).toMatch(/job not found or unauthorized/i);
  });

  it('12. Production without API key fails in background with safe error and no fake transcript', async () => {
    const origEnv = process.env.NODE_ENV;
    const origKey = process.env.OPENAI_API_KEY;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.OPENAI_API_KEY;

      const res = await request(app)
        .post('/api/dubbing/transcribe')
        .set('Cookie', userACookie)
        .send({
          duration: 20,
          language: 'en',
          projectId: userAProjectId,
        });

      expect(res.status).toBe(202);
      const jobId = res.body.jobId;

      const jobData = await pollJob(jobId, userACookie);
      expect(jobData.status).toBe('failed');
      expect(jobData).not.toHaveProperty('result');
      expect(jobData.error).toMatch(/OPENAI_API_KEY is missing/i);
      expect(jobData.error).not.toContain('/home/');
      expect(jobData.error).not.toContain('/run/media');
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origKey !== undefined) {
        process.env.OPENAI_API_KEY = origKey;
      }
    }
  });
});
