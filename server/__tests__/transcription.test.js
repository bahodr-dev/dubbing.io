import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '../db.js';
import * as transcriptionRepo from '../repositories/transcriptionRepository.js';

describe('Real Video Transcription API & Integration Tests (/api/dubbing)', () => {
  let userACookie = '';
  let userBCookie = '';
  let userAId = '';
  let userAProjectId = '';
  let userAMediaId = '';
  let asyncJobId = '';

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

  it('4. Performs synchronous transcription and returns timestamped dialogue segments', async () => {
    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userACookie)
      .send({
        duration: 20,
        language: 'en',
        projectId: userAProjectId,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('segments');
    expect(Array.isArray(res.body.segments)).toBe(true);
    expect(res.body.segments.length).toBeGreaterThan(0);

    const firstSeg = res.body.segments[0];
    expect(firstSeg).toHaveProperty('start');
    expect(firstSeg).toHaveProperty('end');
    expect(firstSeg).toHaveProperty('text');
    expect(firstSeg.start).toBeLessThan(firstSeg.end);
    expect(firstSeg.text.length).toBeGreaterThan(0);

    // Verify project segments were synchronized in database
    const proj = db.prepare('SELECT segments_json FROM projects WHERE id = ?').get(userAProjectId);
    const parsedSegments = JSON.parse(proj.segments_json);
    expect(parsedSegments.length).toBe(res.body.segments.length);
  });

  it('5. Creates asynchronous transcription job with 202 Accepted status', async () => {
    const res = await request(app)
      .post('/api/dubbing/transcribe')
      .set('Cookie', userACookie)
      .send({
        async: true,
        duration: 25,
        language: 'en',
        projectId: userAProjectId,
      });

    asyncJobId = res.body.jobId;

    expect(res.status).toBe(202);
    expect(res.body).toHaveProperty('jobId');
    expect(['queued', 'processing']).toContain(res.body.status);
    expect(res.body.jobId).toMatch(/^txjob-/);
  });

  it('6. Owner (User A) can poll transcription job status via GET /api/dubbing/jobs/:jobId', async () => {
    // Wait for pipeline processing to finish
    await new Promise((resolve) => setTimeout(resolve, 300));

    const res = await request(app)
      .get(`/api/dubbing/jobs/${asyncJobId}`)
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('job');
    expect(res.body.job.id).toBe(asyncJobId);
    expect(['processing', 'completed']).toContain(res.body.job.status);

    if (res.body.job.status === 'completed') {
      expect(res.body.job.segments.length).toBeGreaterThan(0);
    }
  });

  it('7. Non-owner (User B) is FORBIDDEN from accessing User A transcription job (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/dubbing/jobs/${asyncJobId}`)
      .set('Cookie', userBCookie);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/job not found or unauthorized/i);
  });

  it('8. Database persists transcription_jobs and transcript_segments records', async () => {
    // Wait a brief moment to ensure DB write completion
    await new Promise((resolve) => setTimeout(resolve, 200));

    const dbJob = transcriptionRepo.findJobById(asyncJobId);
    expect(dbJob).toBeDefined();
    expect(dbJob.user_id).toBe(userAId);
    expect(dbJob.project_id).toBe(userAProjectId);

    const segments = transcriptionRepo.findSegmentsByJobId(asyncJobId);
    expect(Array.isArray(segments)).toBe(true);
    if (dbJob.status === 'completed') {
      expect(segments.length).toBeGreaterThan(0);
      expect(segments[0].start_time).toBeDefined();
      expect(segments[0].end_time).toBeDefined();
      expect(segments[0].text).toBeDefined();
    }
  });

  it('9. Error responses do not leak internal filesystem paths or secrets', async () => {
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
});
