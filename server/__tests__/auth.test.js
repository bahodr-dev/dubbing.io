import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '../db.js';

describe('Auth API Routes (/api/auth)', () => {
  const testEmail = `testuser_${Date.now()}@dubbing.io`;
  const testPassword = 'Password123!';
  let authToken = '';

  it('POST /api/auth/signup - creates new user account and returns JWT token', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: testEmail,
        password: testPassword,
        name: 'Test Engineer',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(testEmail.toLowerCase());
    authToken = res.body.token;
  });

  it('POST /api/auth/signup - rejects duplicate email with 409 Conflict', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/auth/signup - rejects password shorter than 6 characters', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: 'shortpass@dubbing.io',
        password: '123',
      });

    expect(res.status).toBe(400);
  });

  it('POST /api/auth/signin - logs in existing user with correct password', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe(testEmail.toLowerCase());
  });

  it('POST /api/auth/signin - rejects incorrect password with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({
        email: testEmail,
        password: 'WrongPassword!',
      });

    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me - returns user profile when valid token provided', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail.toLowerCase());
  });

  it('GET /api/auth/me - rejects request when no token provided with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
