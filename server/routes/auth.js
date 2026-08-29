import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../middleware/auth.js';
import * as userRepository from '../repositories/userRepository.js';
import { generateToken, setAuthCookie, clearAuthCookie } from '../services/auth/sessionService.js';
import { startOAuth, handleOAuthCallback } from '../services/auth/oauthService.js';

export const authRouter = Router();

// Helper to get frontend App URL
function getAppUrl() {
  return process.env.APP_URL || 'http://localhost:5173';
}

// 1. SIGN UP (Email + Password)
authRouter.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check duplicate account
    const existing = userRepository.findByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    // Securely hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = userRepository.createUser({
      email: cleanEmail,
      name: name ? name.trim() : null,
      passwordHash,
      provider: 'email',
    });

    const token = generateToken(newUser);
    setAuthCookie(res, token);

    return res.status(201).json({
      user: userRepository.formatUser(newUser),
      message: 'Account created successfully!',
    });
  } catch (err) {
    console.error('Error in /signup:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// 2. SIGN IN (Email + Password)
authRouter.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = userRepository.findByEmail(cleanEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.password_hash) {
      return res.status(400).json({
        error: `This account was registered using ${user.provider}. Please sign in with ${user.provider}.`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    setAuthCookie(res, token);

    return res.json({
      user: userRepository.formatUser(user),
      message: 'Logged in successfully!',
    });
  } catch (err) {
    console.error('Error in /signin:', err);
    return res.status(500).json({ error: 'Internal server error during sign in.' });
  }
});

// 3. GET CURRENT AUTHENTICATED USER
authRouter.get('/me', authenticateToken, (req, res) => {
  try {
    const user = userRepository.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    return res.json({ user: userRepository.formatUser(user) });
  } catch (err) {
    console.error('Error in /me:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// 4. SIGN OUT
authRouter.post(['/signout', '/logout'], (_req, res) => {
  clearAuthCookie(res);
  return res.json({ message: 'Logged out successfully.' });
});

// 5. OAUTH START (Google, GitHub, Microsoft)
const handleOAuthRedirect = (req, res) => {
  const { provider } = req.params;
  const rawRedirect = req.query.redirect_url;
  let redirectUrl = '/dashboard';
  if (typeof rawRedirect === 'string' && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')) {
    redirectUrl = rawRedirect;
  }
  try {
    const { authUrl } = startOAuth(provider, { redirectUrl });
    return res.redirect(authUrl);
  } catch (err) {
    console.error(`Error starting ${provider} OAuth:`, err);
    const appUrl = getAppUrl();
    return res.redirect(`${appUrl}/signup?error=oauth_failed`);
  }
};

authRouter.get('/google', (req, res) => {
  req.params.provider = 'google';
  return handleOAuthRedirect(req, res);
});
authRouter.get('/github', (req, res) => {
  req.params.provider = 'github';
  return handleOAuthRedirect(req, res);
});
authRouter.get('/microsoft', (req, res) => {
  req.params.provider = 'microsoft';
  return handleOAuthRedirect(req, res);
});

// 6. OAUTH CALLBACK (Google, GitHub, Microsoft)
const mapErrorCode = (msg) => {
  if (!msg) return 'oauth_failed';
  const lower = String(msg).toLowerCase();
  if (lower.includes('denied') || lower.includes('cancelled') || lower.includes('consent_required')) return 'oauth_denied';
  if (lower.includes('expired')) return 'oauth_expired';
  if (lower.includes('invalid') || lower.includes('state') || lower.includes('mismatch')) return 'oauth_state_invalid';
  return 'oauth_failed';
};

const handleOAuthCallbackRoute = async (req, res) => {
  const appUrl = getAppUrl();
  const { provider } = req.params;
  const { code, state, error, error_description } = req.query;

  const renderError = (errorMsg) => {
    const errorCode = mapErrorCode(errorMsg);
    return res.send(`<!DOCTYPE html>
<html>
<head><title>Authentication Error</title></head>
<body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <p style="color:#ef4444;font-size:14px;">Authentication failed. Please try again.</p>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'DUBBING_AUTH_ERROR', error: ${JSON.stringify(errorCode)} }, ${JSON.stringify(appUrl)});
        setTimeout(() => window.close(), 600);
      } else {
        window.location.replace("${appUrl}/signup?error=${encodeURIComponent(errorCode)}");
      }
    } catch(e) {
      window.location.replace("${appUrl}/signup?error=${encodeURIComponent(errorCode)}");
    }
  </script>
</body>
</html>`);
  };

  if (error) {
    console.warn(`OAuth error from ${provider}:`, error, error_description);
    return renderError(`${error} ${error_description || ''}`);
  }

  try {
    const result = await handleOAuthCallback(provider, { code, state });

    // Set secure HTTP-only session cookie
    setAuthCookie(res, result.token);

    let destination = '/dashboard';
    if (
      result.redirectUrl &&
      typeof result.redirectUrl === 'string' &&
      result.redirectUrl.startsWith('/') &&
      !result.redirectUrl.startsWith('//')
    ) {
      destination = result.redirectUrl;
    }

    // Return HTML with postMessage for popup windows and fallback redirect (NO TOKENS IN PAYLOAD OR URL)
    return res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authenticating...</title>
  <style>
    body {
      background-color: #0b0f19;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid rgba(255,255,255,0.15);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 14px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p style="font-size: 14px; opacity: 0.85; letter-spacing: -0.01em;">Completing authentication...</p>
  <script>
    const payload = {
      type: 'DUBBING_AUTH_SUCCESS'
    };

    if (window.opener) {
      try {
        window.opener.postMessage(payload, ${JSON.stringify(appUrl)});
      } catch (err) {}
      setTimeout(() => {
        window.close();
      }, 350);
    } else {
      window.location.replace("${appUrl}${destination}");
    }
  </script>
</body>
</html>`);
  } catch (err) {
    console.error(`OAuth callback error for ${provider}:`, err);
    return renderError(err.message || 'OAuth authentication failed.');
  }
};

authRouter.get('/google/callback', (req, res) => {
  req.params.provider = 'google';
  return handleOAuthCallbackRoute(req, res);
});
authRouter.get('/github/callback', (req, res) => {
  req.params.provider = 'github';
  return handleOAuthCallbackRoute(req, res);
});
authRouter.get('/microsoft/callback', (req, res) => {
  req.params.provider = 'microsoft';
  return handleOAuthCallbackRoute(req, res);
});
