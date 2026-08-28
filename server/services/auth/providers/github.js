/**
 * Real GitHub OAuth 2.0 Provider
 */

export function isConfigured() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

export function getRedirectUri() {
  if (process.env.GITHUB_REDIRECT_URI) {
    return process.env.GITHUB_REDIRECT_URI;
  }
  const apiUrl = process.env.API_URL || 'http://localhost:5000';
  return `${apiUrl}/api/auth/github/callback`;
}

export function getAuthorizationUrl(state) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    throw new Error('GitHub OAuth is not configured: GITHUB_CLIENT_ID is missing.');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    scope: 'read:user user:email',
    state,
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeAndGetProfile(code) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth credentials are missing.');
  }

  // 1. Exchange code for access token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!tokenRes.ok) {
    throw new Error('Failed to exchange authorization code with GitHub.');
  }

  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    throw new Error(`GitHub token error: ${tokenData.error_description || tokenData.error}`);
  }

  const accessToken = tokenData.access_token;

  // 2. Fetch public user profile
  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'User-Agent': 'Dubbing-io-Auth',
      Accept: 'application/vnd.github+json',
    },
  });

  if (!userRes.ok) {
    throw new Error('Failed to retrieve user profile from GitHub.');
  }

  const userData = await userRes.json();
  if (!userData.id) {
    throw new Error('GitHub did not return a valid user ID.');
  }

  // 3. Fetch user emails to get verified primary email
  let primaryEmail = userData.email ? userData.email.toLowerCase() : null;
  let isEmailVerified = false;

  try {
    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Dubbing-io-Auth',
        Accept: 'application/vnd.github+json',
      },
    });

    if (emailsRes.ok) {
      const emails = await emailsRes.json();
      if (Array.isArray(emails)) {
        const verifiedPrimary = emails.find((e) => e.primary && e.verified);
        if (verifiedPrimary) {
          primaryEmail = verifiedPrimary.email.toLowerCase();
          isEmailVerified = true;
        } else {
          const anyVerified = emails.find((e) => e.verified);
          if (anyVerified) {
            primaryEmail = anyVerified.email.toLowerCase();
            isEmailVerified = true;
          } else if (emails.length > 0) {
            primaryEmail = emails[0].email.toLowerCase();
            isEmailVerified = Boolean(emails[0].verified);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[GitHub OAuth] Could not fetch secondary user/emails list:', err);
  }

  return {
    provider: 'github',
    providerAccountId: String(userData.id),
    email: primaryEmail,
    emailVerified: isEmailVerified,
    name: userData.name || userData.login || null,
    avatarUrl: userData.avatar_url || null,
  };
}
