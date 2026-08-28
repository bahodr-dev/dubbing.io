import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Projects API Security & Multi-tenant Isolation (/api/projects)', () => {
  let userAToken = '';
  let userBToken = '';
  let userAProjectId = '';

  beforeAll(async () => {
    // 1. Create User A
    const resA = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `usera_${Date.now()}@dubbing.io`,
        password: 'Password123!',
        name: 'User A',
      });
    userAToken = resA.body.token;

    // 2. Create User B
    const resB = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `userb_${Date.now()}@dubbing.io`,
        password: 'Password123!',
        name: 'User B',
      });
    userBToken = resB.body.token;
  });

  it('POST /api/projects - User A can create a project', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({
        title: "User A Confidential Video Dub",
        targetLanguage: "uz",
        originalLanguage: "en",
        voiceId: "voice-farrux",
        duration: 45,
        transcript: [
          { id: "seg-1", startTime: 0, endTime: 5, originalText: "Secret info", translatedText: "Maxfiy ma'lumot" }
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.project).toHaveProperty('id');
    expect(res.body.project.title).toBe("User A Confidential Video Dub");
    userAProjectId = res.body.project.id;
  });

  it('GET /api/projects - User B only sees their own projects, not User A projects', async () => {
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.projects).toBeInstanceOf(Array);
    const userAProjectInBList = res.body.projects.find((p) => p.id === userAProjectId);
    expect(userAProjectInBList).toBeUndefined();
  });

  it('PUT /api/projects/:id - User B is FORBIDDEN from updating User A project', async () => {
    const res = await request(app)
      .put(`/api/projects/${userAProjectId}`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        title: "Maliciously Hacked Title",
      });

    expect(res.status).toBe(404); // returns 404 project not found for unauthorized user
  });

  it('DELETE /api/projects/:id - User B is FORBIDDEN from deleting User A project', async () => {
    await request(app)
      .delete(`/api/projects/${userAProjectId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    // Verify User A project still exists safely
    const resA = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${userAToken}`);

    const project = resA.body.projects.find((p) => p.id === userAProjectId);
    expect(project).toBeDefined();
    expect(project.title).toBe("User A Confidential Video Dub");
  });

  it('GET /api/dubbing/export/:id/srt - User B CANNOT export User A subtitles', async () => {
    const res = await request(app)
      .get(`/api/dubbing/export/${userAProjectId}/srt`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(404);
  });

  it('GET /api/dubbing/export/:id/srt - User A CAN export their own subtitles', async () => {
    const res = await request(app)
      .get(`/api/dubbing/export/${userAProjectId}/srt`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Maxfiy ma'lumot");
  });
});
