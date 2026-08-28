import * as googleProvider from './providers/google.js';
import * as githubProvider from './providers/github.js';
import * as microsoftProvider from './providers/microsoft.js';
import { createOAuthState, validateAndConsumeState } from './oauthStateService.js';
import * as userRepository from '../../repositories/userRepository.js';
import * as oauthAccountRepository from '../../repositories/oauthAccountRepository.js';
import { generateToken } from './sessionService.js';

const PROVIDERS = {
  google: googleProvider,
  github: githubProvider,
  microsoft: microsoftProvider,
};

export function getProvider(name) {
  const normalized = (name || '').toLowerCase().trim();
  const provider = PROVIDERS[normalized];
  if (!provider) {
    throw new Error(`Unsupported OAuth provider: "${name}". Supported providers are: google, github, microsoft.`);
  }
  return provider;
}

/**
 * Initiates real OAuth flow for the given provider
 */
export function startOAuth(providerName, { redirectUrl = '/dashboard' } = {}) {
  const provider = getProvider(providerName);

  if (!provider.isConfigured()) {
    throw new Error(`${providerName.toUpperCase()} OAuth credentials are not configured in .env on this server.`);
  }

  const usePkce = providerName === 'google' || providerName === 'microsoft';
  const { state, codeChallenge } = createOAuthState({
    provider: providerName,
    redirectUrl,
    usePkce,
  });

  const authUrl = provider.getAuthorizationUrl(state, codeChallenge);
  return { authUrl, state };
}

/**
 * Handles OAuth callback, state validation, profile retrieval, and user account linking
 */
export async function handleOAuthCallback(providerName, { code, state }) {
  if (!code) {
    throw new Error('Missing authorization code from provider.');
  }

  // 1. Validate and consume OAuth state (Anti-CSRF & Anti-Replay)
  const stateValidation = validateAndConsumeState(state, providerName);
  if (!stateValidation.valid) {
    throw new Error(stateValidation.error || 'Invalid OAuth state.');
  }

  const { stateData } = stateValidation;
  const provider = getProvider(providerName);

  // 2. Exchange code for tokens and fetch user profile
  const profile = await provider.exchangeCodeAndGetProfile(code, stateData.code_verifier);

  if (!profile || !profile.providerAccountId) {
    throw new Error(`Failed to obtain provider account identifier from ${providerName}.`);
  }

  // 3. User Matching & Account Linking Strategy
  let user = null;

  // Step 3a: Check for existing linked OAuth account
  const existingOAuth = oauthAccountRepository.findByProviderAccount(
    profile.provider,
    profile.providerAccountId
  );

  if (existingOAuth) {
    user = userRepository.findById(existingOAuth.user_id);
    if (!user) {
      throw new Error('Linked user account was not found.');
    }
  } else {
    // Step 3b: If not linked, check if provider supplied a VERIFIED email
    if (profile.emailVerified && profile.email) {
      const existingUserByEmail = userRepository.findByEmail(profile.email);

      if (existingUserByEmail) {
        // Link new OAuth provider to existing user
        user = existingUserByEmail;
        oauthAccountRepository.createOAuthAccount({
          userId: user.id,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          providerEmail: profile.email,
        });
      } else {
        // Create new user and link
        user = userRepository.createUser({
          email: profile.email,
          name: profile.name,
          avatarUrl: profile.avatarUrl || '',
          provider: profile.provider,
        });
        oauthAccountRepository.createOAuthAccount({
          userId: user.id,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          providerEmail: profile.email,
        });
      }
    } else {
      // Unverified email: NEVER automatically link to an existing user (prevent account takeover)
      let targetEmail = profile.email;
      if (targetEmail) {
        const existing = userRepository.findByEmail(targetEmail);
        if (existing) {
          // The email belongs to an existing user but is unverified from this provider.
          // Isolate into a distinct provider account to avoid collision and prevent hijacking.
          targetEmail = `${profile.provider}_${profile.providerAccountId}@oauth.local`;
        }
      } else {
        targetEmail = `${profile.provider}_${profile.providerAccountId}@oauth.local`;
      }

      user = userRepository.createUser({
        email: targetEmail,
        name: profile.name || `${profile.provider} User`,
        avatarUrl: profile.avatarUrl || '',
        provider: profile.provider,
      });
      oauthAccountRepository.createOAuthAccount({
        userId: user.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        providerEmail: profile.email,
      });
    }
  }

  // 4. Generate application session
  const token = generateToken(user);

  return {
    user: userRepository.formatUser(user),
    token,
    redirectUrl: stateData.redirect_url || '/dashboard',
  };
}
