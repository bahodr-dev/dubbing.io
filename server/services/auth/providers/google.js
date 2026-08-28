/**
 * Real Google OAuth 2.0 / OpenID Connect Provider
 */

export function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function getRedirectUri() {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }
  const apiUrl = process.env.API_URL || 'http://localhost:5000';
  return `${apiUrl}/api/auth/google/callback`;
}

export function getAuthorizationUrl(state, codeChallenge = null) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Google OAuth is not configured: GOOGLE_CLIENT_ID is missing.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'offline',
    prompt: 'select_account',
  });

  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeAndGetProfile(code, codeVerifier = null) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials are missing.');
  }

  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: getRedirectUri(),
  });

  if (codeVerifier) {
    tokenParams.set('code_verifier', codeVerifier);
  }

  // 1. Exchange authorization code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    const errorData = await tokenRes.json().catch(() => ({}));
    throw new Error(`Google token exchange failed: ${errorData.error_description || errorData.error || tokenRes.statusText}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // 2. Fetch authenticated user profile
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!userRes.ok) {
    throw new Error('Failed to retrieve user profile from Google.');
  }

  const userData = await userRes.json();

  if (!userData.sub) {
    throw new Error('Google did not return a valid user identifier (sub).');
  }

  return {
    provider: 'google',
    providerAccountId: String(userData.sub),
    email: userData.email ? userData.email.toLowerCase() : null,
    emailVerified: Boolean(userData.email_verified),
    name: userData.name || userData.given_name || null,
    avatarUrl: userData.picture || null,
  };
}
