import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '../db.js';
import { createInvite } from '../repositories/betaInviteRepository.js';

describe('closed beta invites', () => {
  afterEach(() => { delete process.env.BETA_INVITE_REQUIRED; });

  it('requires an invite when closed beta mode is enabled', async () => {
    process.env.BETA_INVITE_REQUIRED = 'true';
    const response = await request(app).post('/api/auth/signup').send({
      email: `required_${Date.now()}@example.com`, password: 'Password123!',
    });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('INVITE_REQUIRED');
  });

  it('binds an invite to its email and consumes it once', async () => {
    process.env.BETA_INVITE_REQUIRED = 'true';
    const email = `invited_${Date.now()}@example.com`;
    const invite = createInvite({ email });
    const mismatch = await request(app).post('/api/auth/signup').send({
      email: `other_${Date.now()}@example.com`, password: 'Password123!', inviteToken: invite.token,
    });
    expect(mismatch.status).toBe(403);
    expect(mismatch.body.code).toBe('INVITE_EMAIL_MISMATCH');

    const accepted = await request(app).post('/api/auth/signup').send({
      email, password: 'Password123!', inviteToken: invite.token,
    });
    expect(accepted.status).toBe(201);
    const stored = db.prepare('SELECT token_hash, used_at, used_by FROM beta_invites WHERE id = ?').get(invite.id);
    expect(stored.token_hash).not.toContain(invite.token);
    expect(stored.used_at).toBeTypeOf('number');
    expect(stored.used_by).toBe(accepted.body.user.id);

    const replay = await request(app).post('/api/auth/signup').send({
      email: `replay_${Date.now()}@example.com`, password: 'Password123!', inviteToken: invite.token,
    });
    expect(replay.status).toBe(403);
    expect(replay.body.code).toBe('INVITE_INVALID');
  });

  it('rejects an expired invite', async () => {
    process.env.BETA_INVITE_REQUIRED = 'true';
    const email = `expired_${Date.now()}@example.com`;
    const invite = createInvite({ email, expiresAt: Date.now() - 1 });
    const response = await request(app).post('/api/auth/signup').send({
      email, password: 'Password123!', inviteToken: invite.token,
    });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('INVITE_EXPIRED');
  });

  it('allows only one winner during parallel redemption', async () => {
    process.env.BETA_INVITE_REQUIRED = 'true';
    const email = `parallel_${Date.now()}@example.com`;
    const invite = createInvite({ email });
    const payload = { email, password: 'Password123!', inviteToken: invite.token };
    const responses = await Promise.all([
      request(app).post('/api/auth/signup').send(payload),
      request(app).post('/api/auth/signup').send(payload),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(db.prepare('SELECT COUNT(*) AS count FROM users WHERE email = ?').get(email).count).toBe(1);
  });
});
