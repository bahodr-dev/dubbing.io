import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '../db.js';
import * as transcriptionRepo from '../repositories/transcriptionRepository.js';
import { JobManager } from '../services/jobQueue.js';

describe('Real Video Transcription API & Integration Tests (/api/dubbing)', () => {
  let userACookie = '';
  let userBCookie = '';
  let userAId = '';
  let _userBId = '';
  let userAProjectId = '';
  let userAMediaId = '';
  let successfulJobId = '';
  let failedJobId = '';

  beforeAll(async () => {
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

    // 4. User A uploads a media file
    const dummyBuffer = Buffer.from('FAKE_VIDEO_STREAM_FOR_TRANSCRIPTION_TEST_123');
    const uploadRes = await request(app)
      .post('/api/media/upload')
      .set('Cookie', userACookie)
      .attach('file', dummyBuffer, 'interview_sample.mp4');
    userAMediaId = uploadRes.body.id;
  });

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
        mediaId: userAMediaId,
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

  it('4. Test A — Default request (without async flag) is always asynchronous and returns 202', async () => {
    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userACookie)
      .send({
        duration: 20,
        language: 'en',
        projectId: userAProjectId,
      });

    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty('jobId');
    expect(res.body.jobId).toMatch(/^txjob-/);
    expect(['queued', 'processing']).toContain(res.body.status);
    expect(res.body).not.toHaveProperty('segments'); // Proves no synchronous transcription in request

    successfulJobId = res.body.jobId;
  });

  it('5. Test B — Request with async: false is also asynchronous and returns 202', async () => {
    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userACookie)
      .send({
        async: false,
        duration: 20,
        language: 'en',
        projectId: userAProjectId,
      });

    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty('jobId');
    expect(['queued', 'processing']).toContain(res.body.status);
    expect(res.body).not.toHaveProperty('segments');
  });

  it('6. Test C — Route uses JobManager.createTranscriptionJob and does not block synchronously', async () => {
    const createJobSpy = vi.spyOn(JobManager, 'createTranscriptionJob');

    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userACookie)
      .send({
        duration: 15,
        language: 'uz',
        projectId: userAProjectId,
        mediaId: userAMediaId,
        providerType: 'mock',
      });

    expect(res.status).toBe(202);
    expect(createJobSpy).toHaveBeenCalledTimes(1);
    expect(createJobSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: userAId,
        projectId: userAProjectId,
        mediaId: userAMediaId,
        filePath: expect.any(String),
        duration: 15,
        language: 'uz',
        providerType: 'mock',
      })
    );

    createJobSpy.mockRestore();
  });

  it('7. Test D — Job lifecycle progression (queued → processing → completed)', async () => {
    // 1. Create a job directly to verify immediate 'queued' state
    const job = JobManager.createTranscriptionJob({
      userId: userAId,
      projectId: userAProjectId,
      duration: 30,
      language: 'en',
      providerType: 'mock',
    });

    expect(job.status).toBe('queued');
    expect(job.id).toMatch(/^txjob-/);

    // 2. Poll for progression to processing and completed
    let attempts = 0;
    let completedJobData = null;

    while (attempts < 20) {
      const res = await request(app)
        .get(`/api/dubbing/transcribe/jobs/${successfulJobId}`)
        .set('Cookie', userACookie);

      expect(res.status).toBe(200);
      if (res.body.status === 'completed') {
        completedJobData = res.body;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    expect(completedJobData).not.toBeNull();
    expect(completedJobData.status).toBe('completed');
    expect(completedJobData.progress).toBe(100);
    expect(completedJobData).toHaveProperty('result');
    expect(completedJobData.result).toHaveProperty('segments');
    expect(Array.isArray(completedJobData.result.segments)).toBe(true);
    expect(completedJobData.result.segments.length).toBeGreaterThan(0);

    const firstSeg = completedJobData.result.segments[0];
    expect(firstSeg).toHaveProperty('start');
    expect(firstSeg).toHaveProperty('end');
    expect(firstSeg).toHaveProperty('text');
    expect(firstSeg.start).toBeLessThan(firstSeg.end);

    // Verify segments were persisted in SQLite database
    const dbJob = transcriptionRepo.findJobById(successfulJobId);
    expect(dbJob).toBeDefined();
    expect(dbJob.status).toBe('completed');

    const dbSegments = transcriptionRepo.findSegmentsByJobId(successfulJobId);
    expect(dbSegments.length).toBeGreaterThan(0);

    // Verify project segments_json in database was synchronized
    const proj = db.prepare('SELECT segments_json FROM projects WHERE id = ?').get(userAProjectId);
    expect(proj.segments_json).toBeDefined();
    const parsedSegments = JSON.parse(proj.segments_json);
    expect(parsedSegments.length).toBe(completedJobData.result.segments.length);
  });

  it('8. Test E — Failure handling (queued → processing → failed) stores safe error on job', async () => {
    // Create a job with an invalid / non-existent media file to trigger pipeline failure
    const failedJob = JobManager.createTranscriptionJob({
      userId: userAId,
      projectId: userAProjectId,
      filePath: '/non_existent_directory/invalid_corrupt_video.mp4',
      providerType: 'openai',
    });
    failedJobId = failedJob.id;

    // Wait for failure
    let attempts = 0;
    let failedJobData = null;

    while (attempts < 20) {
      const res = await request(app)
        .get(`/api/dubbing/transcribe/jobs/${failedJobId}`)
        .set('Cookie', userACookie);

      expect(res.status).toBe(200);
      failedJobData = res.body;

      if (failedJobData.status === 'failed') {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    expect(failedJobData.status).toBe('failed');
    expect(failedJobData).toHaveProperty('error');
    expect(typeof failedJobData.error).toBe('string');
    expect(failedJobData.error.length).toBeGreaterThan(0);

    // Ensure error does not leak sensitive absolute system paths or secrets
    expect(failedJobData.error).not.toContain('/non_existent_directory');
    expect(failedJobData.error).not.toContain('/run/media');
    expect(failedJobData.error).not.toContain('/home/');

    // Check DB record
    const dbFailedJob = transcriptionRepo.findJobById(failedJobId);
    expect(dbFailedJob).toBeDefined();
    expect(dbFailedJob.status).toBe('failed');
  });

  it('9. Test F — Ownership isolation (User B cannot retrieve User A transcription job)', async () => {
    // User B attempts to access User A's successful job via /transcribe/jobs/:jobId
    const res1 = await request(app)
      .get(`/api/dubbing/transcribe/jobs/${successfulJobId}`)
      .set('Cookie', userBCookie);

    expect(res1.status).toBe(404);
    expect(res1.body.error).toMatch(/job not found or unauthorized/i);

    // User B attempts to access User A's job via /jobs/:jobId
    const res2 = await request(app)
      .get(`/api/dubbing/jobs/${successfulJobId}`)
      .set('Cookie', userBCookie);

    expect(res2.status).toBe(404);
    expect(res2.body.error).toMatch(/job not found or unauthorized/i);

    // User B attempts to access a non-existent random jobId
    const res3 = await request(app)
      .get('/api/dubbing/transcribe/jobs/txjob-fake-id-99999')
      .set('Cookie', userBCookie);

    expect(res3.status).toBe(404);
  });

  it('10. Security: Error responses do not leak internal filesystem paths or secrets', async () => {
    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userACookie)
      .send({
        mediaPath: '/etc/shadow',
      });

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('/etc/shadow');
    expect(JSON.stringify(res.body)).not.toContain('/run/media');
    expect(JSON.stringify(res.body)).not.toContain('/home/');
  });

  it('11. Async job integration: Production without API key fails in background and does NOT produce fake transcript', async () => {
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
      expect(res.body).toHaveProperty('jobId');
      const prodJobId = res.body.jobId;

      // Poll until finished
      let attempts = 0;
      let prodJobData = null;

      while (attempts < 20) {
        const pollRes = await request(app)
          .get(`/api/dubbing/transcribe/jobs/${prodJobId}`)
          .set('Cookie', userACookie);

        expect(pollRes.status).toBe(200);
        prodJobData = pollRes.body;

        if (prodJobData.status === 'failed' || prodJobData.status === 'completed') {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }

      // MUST NOT be completed or contain fake transcript
      expect(prodJobData.status).toBe('failed');
      expect(prodJobData).not.toHaveProperty('result');
      expect(prodJobData.error).toMatch(/OPENAI_API_KEY is missing/i);

      // Verify safe error scrubbing
      expect(prodJobData.error).not.toContain('/home/');
      expect(prodJobData.error).not.toContain('/run/media');
    } finally {
      process.env.NODE_ENV = origEnv;
      if (origKey !== undefined) {
        process.env.OPENAI_API_KEY = origKey;
      }
    }
  });
});
