import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { app } from '../app.js';
import { db } from '../db.js';

describe('Dubbing minute preflight', () => {
  const fixturePath = path.join(os.tmpdir(), `dubla-minute-check-${process.pid}.mp4`);
  let ownerCookie;
  let otherCookie;
  let ownerId;
  let mediaId;

  beforeAll(async () => {
    const ffmpeg = spawnSync('ffmpeg', [
      '-nostdin', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=12',
      '-c:a', 'aac', fixturePath,
    ], { stdio: 'ignore' });
    expect(ffmpeg.status).toBe(0);

    const owner = await request(app).post('/api/auth/signup').send({
      email: `minute-owner-${Date.now()}@example.com`, password: 'Password123!', name: 'Minute Owner',
    });
    expect(owner.status).toBe(201);
    ownerId = owner.body.user.id;
    ownerCookie = owner.headers['set-cookie'].find((cookie) => cookie.includes('dubla_session='));

    const other = await request(app).post('/api/auth/signup').send({
      email: `minute-other-${Date.now()}@example.com`, password: 'Password123!', name: 'Other User',
    });
    expect(other.status).toBe(201);
    otherCookie = other.headers['set-cookie'].find((cookie) => cookie.includes('dubla_session='));

    const upload = await request(app).post('/api/media/upload')
      .set('Cookie', ownerCookie).attach('file', fixturePath, 'minute-sample.mp4');
    expect(upload.status).toBe(201);
    mediaId = upload.body.id;
  });

  afterAll(() => {
    if (fs.existsSync(fixturePath)) fs.unlinkSync(fixturePath);
  });

  it('uses the real file duration and current balance without reserving minutes', async () => {
    db.prepare('UPDATE users SET minutes_balance = ? WHERE id = ?').run(0.1, ownerId);
    const shortBalance = await request(app).post('/api/dubbing/check-minutes')
      .set('Cookie', ownerCookie).send({ mediaId });
    expect(shortBalance.status).toBe(200);
    expect(shortBalance.body.canStart).toBe(false);
    expect(shortBalance.body.duration).toBeGreaterThan(11.9);
    expect(shortBalance.body.requiredMinutes).toBeGreaterThan(0.19);
    expect(shortBalance.body.minutesBalance).toBe(0.1);

    db.prepare('UPDATE users SET minutes_balance = ? WHERE id = ?').run(1, ownerId);
    const enoughBalance = await request(app).post('/api/dubbing/check-minutes')
      .set('Cookie', ownerCookie).send({ mediaId });
    expect(enoughBalance.status).toBe(200);
    expect(enoughBalance.body.canStart).toBe(true);
    expect(db.prepare('SELECT minutes_balance FROM users WHERE id = ?').get(ownerId).minutes_balance).toBe(1);
  });

  it('does not disclose another user’s media duration', async () => {
    const response = await request(app).post('/api/dubbing/check-minutes')
      .set('Cookie', otherCookie).send({ mediaId });
    expect(response.status).toBe(404);
  });

  it('rejects missing and invalid cadence before charging or starting dubbing', async () => {
    const balance = db.prepare('SELECT minutes_balance FROM users WHERE id = ?').get(ownerId).minutes_balance;
    for (const speechCadence of [undefined, '', 'unknown']) {
      const response = await request(app).post('/api/dubbing/process')
        .set('Cookie', ownerCookie).send({ mediaId, speechCadence });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('SPEECH_CADENCE_REQUIRED');
    }
    expect(db.prepare('SELECT minutes_balance FROM users WHERE id = ?').get(ownerId).minutes_balance).toBe(balance);
  });

  it('checks cloning against 1.5 times the automatic voice cost', async () => {
    const automatic = await request(app).post('/api/dubbing/check-minutes')
      .set('Cookie', ownerCookie).send({ mediaId });
    const cloning = await request(app).post('/api/dubbing/check-minutes')
      .set('Cookie', ownerCookie).send({ mediaId, autoCloneVoices: true });
    expect(cloning.body.requiredMinutes).toBeCloseTo(automatic.body.requiredMinutes * 1.5, 5);
  });
});
