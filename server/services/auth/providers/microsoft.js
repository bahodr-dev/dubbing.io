/**
 * Real Microsoft Identity Platform / OpenID Connect Provider
 */

export function getTenant() {
  return process.env.MICROSOFT_TENANT_ID || 'common';
}

export function isConfigured() {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

export function getRedirectUri() {
  if (process.env.MICROSOFT_REDIRECT_URI) {
    return process.env.MICROSOFT_REDIRECT_URI;
  }
  const apiUrl = process.env.API_URL || 'http://localhost:5000';
  return `${apiUrl}/api/auth/microsoft/callback`;
}

export function getAuthorizationUrl(state, codeChallenge = null) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    throw new Error('Microsoft OAuth is not configured: MICROSOFT_CLIENT_ID is missing.');
  }

  const tenant = getTenant();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    response_mode: 'query',
    scope: 'openid profile email User.Read',
    state,
  });

  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }

  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeCodeAndGetProfile(code, codeVerifier = null) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Microsoft OAuth credentials are missing.');
  }

  const tenant = getTenant();
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: getRedirectUri(),
    scope: 'openid profile email User.Read',
  });

  if (codeVerifier) {
    tokenParams.set('code_verifier', codeVerifier);
  }

  // 1. Exchange authorization code for tokens
  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    const errData = await tokenRes.json().catch(() => ({}));
    throw new Error(`Microsoft token exchange failed: ${errData.error_description || errData.error || tokenRes.statusText}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;

  // 2. Fetch authenticated user profile from Microsoft Graph
  const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!graphRes.ok) {
    throw new Error('Failed to retrieve user profile from Microsoft Graph.');
  }

  const graphData = await graphRes.json();

  if (!graphData.id) {
    throw new Error('Microsoft did not return a valid user ID.');
  }

  const email = (graphData.mail || graphData.userPrincipalName || '').toLowerCase() || null;

  return {
    provider: 'microsoft',
    providerAccountId: String(graphData.id),
    email,
    emailVerified: Boolean(email),
    name: graphData.displayName || graphData.givenName || null,
    avatarUrl: null,
  };
}
