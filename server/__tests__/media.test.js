import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../app.js';
import { db, uploadsDir } from '../db.js';

describe('Private Media Storage & User Ownership (/api/media)', () => {
  let userACookie = '';
  let userBCookie = '';
  let userAId = '';
  let userAMediaId = '';
  let userAMediaFilename = '';
  let userAProjectId = '';

  beforeAll(async () => {
    // 1. Create User A
    const resA = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `media_usera_${Date.now()}@dubbing.io`,
        password: 'Password123!',
        name: 'User A Media Owner',
      });
    const cookiesA = resA.headers['set-cookie'] || [];
    userACookie = cookiesA.find((c) => c.includes('dubbing_session='));
    userAId = resA.body.user.id;

    // 2. Create User B
    const resB = await request(app)
      .post('/api/auth/signup')
      .send({
        email: `media_userb_${Date.now()}@dubbing.io`,
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
        title: "User A Confidential Project",
      });
    userAProjectId = projRes.body.project.id;
  });

  it('1. Authenticated user (User A) can upload private media file', async () => {
    const dummyBuffer = Buffer.from('FAKE_VIDEO_CONTENT_BYTE_STREAM_FOR_TESTING_123456');

    const res = await request(app)
      .post('/api/media/upload')
      .set('Cookie', userACookie)
      .attach('file', dummyBuffer, 'confidential_briefing.mp4');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('url');
    expect(res.body.url).toBe(`/api/media/${res.body.id}`);
    expect(res.body.originalName).toBe('confidential_briefing.mp4');
    expect(res.body.mimeType).toBe('video/mp4');
    
    // Ensure internal server paths are NOT exposed to client
    expect(JSON.stringify(res.body)).not.toContain('/run/media');
    expect(JSON.stringify(res.body)).not.toContain('/home/');
    expect(JSON.stringify(res.body)).not.toContain('/database');

    userAMediaId = res.body.id;
    userAMediaFilename = res.body.filename;
  });

  it('2. Unauthenticated upload fails with 401 Unauthorized', async () => {
    const dummyBuffer = Buffer.from('FAKE_VIDEO_CONTENT');
    const res = await request(app)
      .post('/api/media/upload')
      .attach('file', dummyBuffer, 'video.mp4');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('3. Uploaded media creates database record with strict user ownership', () => {
    const asset = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(userAMediaId);
    expect(asset).toBeDefined();
    expect(asset.user_id).toBe(userAId);
    expect(asset.original_filename).toBe('confidential_briefing.mp4');
    expect(asset.stored_filename).toBe(userAMediaFilename);
    expect(asset.mime_type).toBe('video/mp4');
  });

  it('4. Owner (User A) can stream private media via GET /api/media/:id', async () => {
    const res = await request(app)
      .get(`/api/media/${userAMediaId}`)
      .set('Cookie', userACookie)
      .buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('video/mp4');
    expect(res.body.toString('utf-8')).toContain('FAKE_VIDEO_CONTENT_BYTE_STREAM');
  });

  it('5. Non-owner (User B) is FORBIDDEN from accessing User A media (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/media/${userAMediaId}`)
      .set('Cookie', userBCookie);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Media not found.');
  });

  it('6. Unauthenticated request to /api/media/:id is rejected with 401', async () => {
    const res = await request(app).get(`/api/media/${userAMediaId}`);
    expect(res.status).toBe(401);
  });

  it('7. Direct public access /uploads/<filename> is completely BLOCKED (returns 404)', async () => {
    const res = await request(app).get(`/uploads/${userAMediaFilename}`);
    expect(res.status).toBe(404);
  });

  it('8. Supports HTTP Range requests (206 Partial Content) for efficient video seeking', async () => {
    const res = await request(app)
      .get(`/api/media/${userAMediaId}`)
      .set('Cookie', userACookie)
      .set('Range', 'bytes=0-15')
      .buffer(true);

    expect(res.status).toBe(206);
    expect(res.headers['accept-ranges']).toBe('bytes');
    expect(res.headers['content-range']).toMatch(/^bytes 0-15\//);
    expect(res.body.toString('utf-8')).toBe('FAKE_VIDEO_CONTE');
  });

  it('9. Rejects invalid or out-of-bounds HTTP Range requests with 416', async () => {
    const res = await request(app)
      .get(`/api/media/${userAMediaId}`)
      .set('Cookie', userACookie)
      .set('Range', 'bytes=99999-100000');

    expect(res.status).toBe(416);
  });

  it('10. Path traversal attempts with encoded or relative paths are rejected', async () => {
    const res = await request(app)
      .get('/api/media/..%2F..%2Fetc%2Fpasswd')
      .set('Cookie', userACookie);

    expect(res.status).toBe(404);
  });

  it('11. Owner can download private media with sanitized Content-Disposition header', async () => {
    const res = await request(app)
      .get(`/api/media/${userAMediaId}/download`)
      .set('Cookie', userACookie)
      .buffer(true);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBe('attachment; filename="confidential_briefing.mp4"');
    expect(res.body.toString('utf-8')).toContain('FAKE_VIDEO_CONTENT_BYTE_STREAM');
  });

  it('12. Non-owner (User B) CANNOT download User A private media (returns 404)', async () => {
    const res = await request(app)
      .get(`/api/media/${userAMediaId}/download`)
      .set('Cookie', userBCookie);

    expect(res.status).toBe(404);
  });

  it('13. Rejects unsupported MIME types / file extensions', async () => {
    const maliciousBuffer = Buffer.from('malicious script');
    const res = await request(app)
      .post('/api/media/upload')
      .set('Cookie', userACookie)
      .attach('file', maliciousBuffer, 'exploit.exe');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid file type/i);
  });

  it('14. User B CANNOT attach media to User A project', async () => {
    const dummyBuffer = Buffer.from('UNAUTHORIZED_MEDIA');
    const res = await request(app)
      .post('/api/media/upload')
      .set('Cookie', userBCookie)
      .field('projectId', userAProjectId)
      .attach('file', dummyBuffer, 'b_video.mp4');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/project not found or unauthorized/i);
  });

  it('15. Dubbing pipeline POST /api/dubbing/process rejects processing another user media', async () => {
    const res = await request(app)
      .post('/api/dubbing/process')
      .set('Cookie', userBCookie)
      .send({
        mediaId: userAMediaId,
        originalLanguage: 'en',
        targetLanguage: 'uz',
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/media not found or unauthorized/i);
  });

  it('16. Dubbing pipeline POST /api/dubbing/process rejects attaching job to another user project', async () => {
    const res = await request(app)
      .post('/api/dubbing/process')
      .set('Cookie', userBCookie)
      .send({
        projectId: userAProjectId,
        originalLanguage: 'en',
        targetLanguage: 'uz',
      });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/project not found or unauthorized/i);
  });

  it('17. Non-owner (User B) CANNOT delete User A media (returns 404)', async () => {
    const res = await request(app)
      .delete(`/api/media/${userAMediaId}`)
      .set('Cookie', userBCookie);

    expect(res.status).toBe(404);
    // Verify file still exists on disk
    const diskPath = path.join(uploadsDir, userAMediaFilename);
    expect(fs.existsSync(diskPath)).toBe(true);
  });

  it('18. Owner (User A) can delete own media (returns 200, removes DB record and file)', async () => {
    const diskPath = path.join(uploadsDir, userAMediaFilename);
    expect(fs.existsSync(diskPath)).toBe(true);

    const res = await request(app)
      .delete(`/api/media/${userAMediaId}`)
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Media deleted successfully.');

    // Database record is deleted
    const dbRecord = db.prepare('SELECT * FROM media_assets WHERE id = ?').get(userAMediaId);
    expect(dbRecord).toBeUndefined();

    // Physical file is deleted from disk
    expect(fs.existsSync(diskPath)).toBe(false);
  });
});
