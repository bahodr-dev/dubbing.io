import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Auth API Routes (/api/auth)', () => {
  const testEmail = `testuser_${Date.now()}@dubbing.io`;
  const testPassword = 'Password123!';
  let authCookie = '';

  it('POST /api/auth/signup - creates new user account and sets HttpOnly cookie (no JWT in body)', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        email: testEmail,
        password: testPassword,
        name: 'Test Engineer',
      });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeUndefined(); // Token must NOT be exposed in JSON body
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(testEmail.toLowerCase());

    // Verify session cookie attributes
    const cookies = res.headers['set-cookie'] || [];
    const sessionCookie = cookies.find((c) => c.includes('dubbing_session='));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/httponly/i);
    expect(sessionCookie).toMatch(/samesite=lax/i);
    expect(sessionCookie).toMatch(/path=\//i);
    authCookie = sessionCookie;
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

  it('POST /api/auth/signin - logs in existing user and sets HttpOnly cookie (no JWT in body)', async () => {
    const res = await request(app)
      .post('/api/auth/signin')
      .send({
        email: testEmail,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(res.body.user.email).toBe(testEmail.toLowerCase());

    const cookies = res.headers['set-cookie'] || [];
    const sessionCookie = cookies.find((c) => c.includes('dubbing_session='));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/httponly/i);
    authCookie = sessionCookie;
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

  it('GET /api/auth/me - returns user profile when valid HttpOnly session cookie provided', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail.toLowerCase());
    expect(res.body.token).toBeUndefined(); // Token must NOT be in /me response
  });

  it('GET /api/auth/me - rejects request when no cookie provided with 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/auth/signout - removes authentication cookie and invalidates session', async () => {
    const res = await request(app)
      .post('/api/auth/signout')
      .set('Cookie', authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');

    // Cookie is cleared
    const cookies = res.headers['set-cookie'] || [];
    const cleared = cookies.some((c) => c.includes('dubbing_session=;') || c.includes('Max-Age=0') || c.includes('Expires=Thu, 01 Jan 1970'));
    expect(cleared).toBe(true);
  });
});
