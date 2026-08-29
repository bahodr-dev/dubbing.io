import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '../db.js';
import { createOAuthState } from '../services/auth/oauthStateService.js';
import * as userRepository from '../repositories/userRepository.js';
import * as oauthAccountRepository from '../repositories/oauthAccountRepository.js';
import * as googleProvider from '../services/auth/providers/google.js';
import * as githubProvider from '../services/auth/providers/github.js';

describe('OAuth Authentication & Security Tests (/api/auth)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Rejects invalid OAuth state on callback', async () => {
    const res = await request(app)
      .get('/api/auth/google/callback?code=fake_code_123&state=tampered_invalid_state');

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/oauth_state_invalid/i);
    expect(res.text).not.toContain('fake_code_123');
  });

  it('2. Rejects missing OAuth state on callback', async () => {
    const res = await request(app)
      .get('/api/auth/github/callback?code=fake_code_123');

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/oauth_state_invalid/i);
  });

  it('3. Rejects expired OAuth state', async () => {
    const expiredState = 'expired_state_test_xyz';
    db.prepare(`
      INSERT INTO oauth_states (state, provider, code_verifier, redirect_url, expires_at)
      VALUES (?, 'google', null, '/dashboard', ?)
    `).run(expiredState, Date.now() - 5000);

    const res = await request(app)
      .get(`/api/auth/google/callback?code=fake_code_123&state=${expiredState}`);

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/oauth_expired/i);
  });

  it('4. Atomically consumes OAuth state to prevent reuse / replay attacks', async () => {
    const { state } = createOAuthState({ provider: 'google', redirectUrl: '/dashboard' });

    vi.spyOn(googleProvider, 'exchangeCodeAndGetProfile').mockResolvedValue({
      provider: 'google',
      providerAccountId: `sub_single_use_${Date.now()}`,
      email: `singleuse_${Date.now()}@dubbing.io`,
      emailVerified: true,
      name: 'Single Use User',
      avatarUrl: '',
    });

    // First use: success
    const firstRes = await request(app)
      .get(`/api/auth/google/callback?code=code_1&state=${state}`);
    expect(firstRes.status).toBe(200);
    expect(firstRes.text).toContain('DUBBING_AUTH_SUCCESS');

    // Second use with same state: must fail with invalid state error
    const replayRes = await request(app)
      .get(`/api/auth/google/callback?code=code_2&state=${state}`);
    expect(replayRes.status).toBe(200);
    expect(replayRes.text).toMatch(/oauth_state_invalid/i);
  });

  it('5. Existing OAuth account logs in with HttpOnly cookie and NO token in postMessage or URL', async () => {
    const existingUser = userRepository.createUser({
      email: `oauth_existing_${Date.now()}@dubbing.io`,
      name: 'Existing Google User',
      provider: 'google',
    });

    const googleAccountId = `google_sub_${Date.now()}`;
    oauthAccountRepository.createOAuthAccount({
      userId: existingUser.id,
      provider: 'google',
      providerAccountId: googleAccountId,
      providerEmail: existingUser.email,
    });

    vi.spyOn(googleProvider, 'exchangeCodeAndGetProfile').mockResolvedValue({
      provider: 'google',
      providerAccountId: googleAccountId,
      email: existingUser.email,
      emailVerified: true,
      name: 'Existing Google User',
      avatarUrl: 'https://example.com/avatar.jpg',
    });

    const { state } = createOAuthState({ provider: 'google', redirectUrl: '/dashboard' });

    const res = await request(app)
      .get(`/api/auth/google/callback?code=mock_google_auth_code&state=${state}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('DUBBING_AUTH_SUCCESS');

    // SECURITY CHECKS:
    // 1. NO token in postMessage payload
    expect(res.text).not.toContain('"token":');
    expect(res.text).not.toContain('token:');
    // 2. NO wildcard origin in postMessage
    expect(res.text).not.toContain("'*'");
    expect(res.text).not.toContain('"*"');
    // 3. NO ?token= in URL redirect
    expect(res.text).not.toContain('?token=');
    expect(res.text).not.toContain('#token=');

    // 4. Session cookie is set securely with HttpOnly
    const cookies = res.headers['set-cookie'] || [];
    const sessionCookie = cookies.find((c) => c.includes('dubbing_session='));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/httponly/i);
    expect(sessionCookie).toMatch(/samesite=lax/i);
  });

  it('6. New OAuth account creates a new user and linked oauth_accounts record', async () => {
    const newGoogleEmail = `new_google_user_${Date.now()}@dubbing.io`;
    const newGoogleSub = `sub_${Date.now()}`;

    vi.spyOn(googleProvider, 'exchangeCodeAndGetProfile').mockResolvedValue({
      provider: 'google',
      providerAccountId: newGoogleSub,
      email: newGoogleEmail,
      emailVerified: true,
      name: 'Brand New User',
      avatarUrl: '',
    });

    const { state } = createOAuthState({ provider: 'google', redirectUrl: '/dashboard' });

    const res = await request(app)
      .get(`/api/auth/google/callback?code=mock_code&state=${state}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('DUBBING_AUTH_SUCCESS');

    const createdUser = userRepository.findByEmail(newGoogleEmail);
    expect(createdUser).toBeDefined();
    expect(createdUser.name).toBe('Brand New User');

    const linkedAccount = oauthAccountRepository.findByProviderAccount('google', newGoogleSub);
    expect(linkedAccount).toBeDefined();
    expect(linkedAccount.user_id).toBe(createdUser.id);
  });

  it('7. Verified email matching links new GitHub OAuth provider to existing user', async () => {
    const sharedEmail = `shared_user_${Date.now()}@dubbing.io`;
    const existingPasswordUser = userRepository.createUser({
      email: sharedEmail,
      name: 'Password User',
      provider: 'email',
    });

    const githubId = `gh_${Date.now()}`;

    vi.spyOn(githubProvider, 'exchangeCodeAndGetProfile').mockResolvedValue({
      provider: 'github',
      providerAccountId: githubId,
      email: sharedEmail,
      emailVerified: true,
      name: 'GitHub Profile',
      avatarUrl: '',
    });

    const { state } = createOAuthState({ provider: 'github', redirectUrl: '/dashboard' });

    const res = await request(app)
      .get(`/api/auth/github/callback?code=mock_github_code&state=${state}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('DUBBING_AUTH_SUCCESS');

    const linkedAccount = oauthAccountRepository.findByProviderAccount('github', githubId);
    expect(linkedAccount).toBeDefined();
    expect(linkedAccount.user_id).toBe(existingPasswordUser.id);
  });

  it('8. Unverified email NEVER automatically links to an existing user account', async () => {
    const victimEmail = `victim_${Date.now()}@dubbing.io`;
    const victimUser = userRepository.createUser({
      email: victimEmail,
      name: 'Victim User',
      provider: 'email',
    });

    const attackerGithubId = `gh_attacker_${Date.now()}`;

    vi.spyOn(githubProvider, 'exchangeCodeAndGetProfile').mockResolvedValue({
      provider: 'github',
      providerAccountId: attackerGithubId,
      email: victimEmail,
      emailVerified: false, // UNVERIFIED!
      name: 'Attacker Impersonator',
      avatarUrl: null,
    });

    const { state } = createOAuthState({ provider: 'github', redirectUrl: '/dashboard' });

    const res = await request(app)
      .get(`/api/auth/github/callback?code=mock_gh_code&state=${state}`);

    expect(res.status).toBe(200);

    const linkedAccount = oauthAccountRepository.findByProviderAccount('github', attackerGithubId);
    expect(linkedAccount).toBeDefined();
    expect(linkedAccount.user_id).not.toBe(victimUser.id);
  });

  it('9. Rejects open redirect attempts in OAuth flow', async () => {
    const { state } = createOAuthState({
      provider: 'google',
      redirectUrl: 'https://evil.com/steal-session',
    });

    vi.spyOn(googleProvider, 'exchangeCodeAndGetProfile').mockResolvedValue({
      provider: 'google',
      providerAccountId: `sub_open_redir_${Date.now()}`,
      email: `openredir_${Date.now()}@dubbing.io`,
      emailVerified: true,
      name: 'Test User',
      avatarUrl: '',
    });

    const res = await request(app)
      .get(`/api/auth/google/callback?code=mock_code&state=${state}`);

    expect(res.status).toBe(200);
    // Must NOT redirect to evil.com
    expect(res.text).not.toContain('https://evil.com');
    expect(res.text).toContain('/dashboard');
  });

  it('10. OAuth error handler does NOT render unsanitized provider HTML', async () => {
    const maliciousPayload = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
    const res = await request(app)
      .get(`/api/auth/google/callback?error=access_denied&error_description=${encodeURIComponent(maliciousPayload)}`);

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('<script>alert("XSS")</script>');
    expect(res.text).not.toContain('<img src=x');
    expect(res.text).toContain('oauth_denied');
  });
});
