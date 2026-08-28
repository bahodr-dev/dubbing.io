import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '../db.js';
import { createOAuthState } from '../services/auth/oauthStateService.js';
import * as userRepository from '../repositories/userRepository.js';
import * as oauthAccountRepository from '../repositories/oauthAccountRepository.js';
import * as googleProvider from '../services/auth/providers/google.js';
import * as githubProvider from '../services/auth/providers/github.js';
import * as microsoftProvider from '../services/auth/providers/microsoft.js';

describe('OAuth Authentication & Security Tests (/api/auth)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('11. Rejects invalid OAuth state on callback', async () => {
    const res = await request(app)
      .get('/api/auth/google/callback?code=fake_code_123&state=tampered_invalid_state');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=');
    expect(res.headers.location).toMatch(/invalid/i);
  });

  it('12. Rejects missing OAuth state on callback', async () => {
    const res = await request(app)
      .get('/api/auth/github/callback?code=fake_code_123');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=');
    expect(res.headers.location).toMatch(/missing/i);
  });

  it('13. Rejects expired OAuth state', async () => {
    // Insert an expired state manually into DB
    const expiredState = 'expired_state_test_xyz';
    db.prepare(`
      INSERT INTO oauth_states (state, provider, code_verifier, redirect_url, expires_at)
      VALUES (?, 'microsoft', null, '/dashboard', ?)
    `).run(expiredState, Date.now() - 5000);

    const res = await request(app)
      .get(`/api/auth/microsoft/callback?code=fake_code_123&state=${expiredState}`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=');
    expect(res.headers.location).toMatch(/expired/i);
  });

  it('14. Existing OAuth account logs into the correct existing user', async () => {
    // Create existing user & linked oauth account
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

    // Mock Google exchangeCodeAndGetProfile
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

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/dashboard');
    // Session cookie is set
    const cookies = res.headers['set-cookie'] || [];
    const hasSessionCookie = cookies.some((c) => c.includes('dubbing_session='));
    expect(hasSessionCookie).toBe(true);
  });

  it('15. New OAuth account creates a new user and linked oauth_accounts record', async () => {
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

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/dashboard');

    // Verify user was created in database
    const createdUser = userRepository.findByEmail(newGoogleEmail);
    expect(createdUser).toBeDefined();
    expect(createdUser.name).toBe('Brand New User');

    // Verify linked oauth_account exists
    const linkedAccount = oauthAccountRepository.findByProviderAccount('google', newGoogleSub);
    expect(linkedAccount).toBeDefined();
    expect(linkedAccount.user_id).toBe(createdUser.id);
  });

  it('16. Verified email matching links new OAuth provider to existing user with same email', async () => {
    // 1. Existing user registered via email/password
    const sharedEmail = `shared_user_${Date.now()}@dubbing.io`;
    const existingPasswordUser = userRepository.createUser({
      email: sharedEmail,
      name: 'Password User',
      provider: 'email',
    });

    const githubId = `gh_${Date.now()}`;

    // 2. Mock GitHub returning the same verified email
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

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/dashboard');

    // Verify GitHub account was linked to existing user ID
    const linkedAccount = oauthAccountRepository.findByProviderAccount('github', githubId);
    expect(linkedAccount).toBeDefined();
    expect(linkedAccount.user_id).toBe(existingPasswordUser.id);
  });

  it('17. Unverified email NEVER automatically links to an existing user account', async () => {
    // 1. Existing victim account
    const victimEmail = `victim_${Date.now()}@dubbing.io`;
    const victimUser = userRepository.createUser({
      email: victimEmail,
      name: 'Victim User',
      provider: 'email',
    });

    const attackerMicrosoftId = `ms_${Date.now()}`;

    // 2. Mock Microsoft returning unverified email matching victim
    vi.spyOn(microsoftProvider, 'exchangeCodeAndGetProfile').mockResolvedValue({
      provider: 'microsoft',
      providerAccountId: attackerMicrosoftId,
      email: victimEmail,
      emailVerified: false, // UNVERIFIED!
      name: 'Attacker Impersonator',
      avatarUrl: null,
    });

    const { state } = createOAuthState({ provider: 'microsoft', redirectUrl: '/dashboard' });

    const res = await request(app)
      .get(`/api/auth/microsoft/callback?code=mock_ms_code&state=${state}`);

    expect(res.status).toBe(302);

    // Verify attacker was NOT linked to victim user ID!
    const linkedAccount = oauthAccountRepository.findByProviderAccount('microsoft', attackerMicrosoftId);
    expect(linkedAccount).toBeDefined();
    expect(linkedAccount.user_id).not.toBe(victimUser.id);
  });
});
