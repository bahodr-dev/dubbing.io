import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { authenticateToken } from '../middleware/auth.js';
import * as userRepository from '../repositories/userRepository.js';
import { generateToken, setAuthCookie, clearAuthCookie } from '../services/auth/sessionService.js';
import { startOAuth, handleOAuthCallback } from '../services/auth/oauthService.js';
import { sendPasswordResetEmail } from '../services/auth/emailService.js';
import * as passwordResetRepository from '../repositories/passwordResetRepository.js';
import { logEvent } from '../services/logger.js';
import * as betaInvites from '../repositories/betaInviteRepository.js';
import { db } from '../db.js';

export const authRouter = Router();

// Helper to get frontend App URL
function getAppUrl() {
  return process.env.APP_URL || 'http://localhost:5173';
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return 'Password must contain 8 to 128 characters.';
  }
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'Password must include at least one letter and one number.';
  }
  return null;
}

function hashResetToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

// 1. SIGN UP (Email + Password)
authRouter.post('/signup', async (req, res) => {
  try {
    const { email, password, name, inviteToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const inviteValidation = betaInvites.validateInviteToken(inviteToken, cleanEmail);
    if (inviteValidation.error) {
      return res.status(403).json({ error: 'A valid beta invite is required.', code: inviteValidation.error });
    }

    // Check duplicate account
    const existing = userRepository.findByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    // Securely hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = userRepository.createUser({
      email: cleanEmail,
      name: name ? name.trim() : null,
      passwordHash,
      provider: 'email',
    });

    if (inviteValidation.invite && !betaInvites.consumeInvite(inviteValidation.invite.id, newUser.id)) {
      db.prepare('DELETE FROM users WHERE id = ?').run(newUser.id);
      return res.status(409).json({ error: 'This beta invite has already been used.', code: betaInvites.INVITE_ERRORS.INVALID });
    }

    const token = generateToken(newUser);
    setAuthCookie(res, token);

    return res.status(201).json({
      user: userRepository.formatUser(newUser),
      message: 'Account created successfully!',
    });
  } catch (err) {
    if (err?.code === 'SQLITE_CONSTRAINT_UNIQUE' || err?.code === 'SQLITE_CONSTRAINT') {
      return res.status(409).json({
        error: 'The account or beta invite has already been used.',
        code: betaInvites.isInviteRequired() ? betaInvites.INVITE_ERRORS.INVALID : undefined,
      });
    }
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
      return res.status(401).json({ error: 'Invalid email or password.' });
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

// 5. REQUEST PASSWORD RESET (always returns the same response to prevent
// account discovery through email enumeration).
authRouter.post('/forgot-password', async (req, res) => {
  const genericResponse = {
    message: 'If an account exists with this email, password reset instructions have been sent.',
  };

  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    const user = userRepository.findByEmail(email);
    if (!user) return res.json(genericResponse);

    passwordResetRepository.removeExpiredPasswordResetTokens();
    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    passwordResetRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt: Date.now() + 30 * 60 * 1000,
    });

    const resetUrl = new URL('/reset-password', getAppUrl());
    resetUrl.searchParams.set('token', rawToken);
    try {
      await sendPasswordResetEmail({ to: user.email, resetUrl: resetUrl.toString() });
      logEvent('password_reset_requested', { userId: user.id });
    } catch (deliveryError) {
      passwordResetRepository.deleteByTokenHash(tokenHash);
      logEvent('password_reset_delivery_failed', { userId: user.id, error: deliveryError.message });
    }

    return res.json(genericResponse);
  } catch (err) {
    logEvent('password_reset_request_failed', { error: err.message });
    return res.json(genericResponse);
  }
});

// 6. CONSUME PASSWORD RESET TOKEN
authRouter.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({ error: 'This password reset link is invalid or has expired.' });
    }
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = passwordResetRepository.consumePasswordResetToken({
      tokenHash: hashResetToken(token),
      passwordHash,
    });
    if (!userId) {
      return res.status(400).json({ error: 'This password reset link is invalid or has expired.' });
    }

    clearAuthCookie(res);
    logEvent('password_reset_completed', { userId });
    return res.json({ message: 'Your password has been updated. Sign in with your new password.' });
  } catch (err) {
    logEvent('password_reset_failed', { error: err.message });
    return res.status(500).json({ error: 'Could not reset the password. Please request a new link.' });
  }
});

// 7. OAUTH START (Google, GitHub, Microsoft)
const handleOAuthRedirect = (req, res) => {
  const { provider } = req.params;
  const rawRedirect = req.query.redirect_url;
  let redirectUrl = '/dashboard';
  if (typeof rawRedirect === 'string' && rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')) {
    redirectUrl = rawRedirect;
  }
  try {
    const inviteToken = typeof req.query.invite === 'string' ? req.query.invite : null;
    const { authUrl } = startOAuth(provider, { redirectUrl, inviteToken });
    return res.redirect(authUrl);
  } catch (err) {
    console.error(`Error starting ${provider} OAuth:`, err);
    const appUrl = getAppUrl();
    return res.redirect(`${appUrl}/signup?error=${encodeURIComponent(err.code || 'oauth_failed')}`);
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

// 8. OAUTH CALLBACK (Google, GitHub, Microsoft)
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
        window.opener.postMessage({ type: 'DUBLA_AUTH_ERROR', error: ${JSON.stringify(errorCode)} }, ${JSON.stringify(appUrl)});
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
      type: 'DUBLA_AUTH_SUCCESS'
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
