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
      token,
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
      token,
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
  const redirectUrl = req.query.redirect_url || '/dashboard';
  try {
    const { authUrl } = startOAuth(provider, { redirectUrl });
    return res.redirect(authUrl);
  } catch (err) {
    console.error(`Error starting ${provider} OAuth:`, err);
    const appUrl = getAppUrl();
    return res.redirect(`${appUrl}/signup?error=${encodeURIComponent(err.message)}`);
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
const handleOAuthCallbackRoute = async (req, res) => {
  const appUrl = getAppUrl();
  const { provider } = req.params;
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.warn(`OAuth error from ${provider}:`, error, error_description);
    return res.redirect(`${appUrl}/signup?error=${encodeURIComponent(error_description || error || 'OAuth authorization failed.')}`);
  }

  try {
    const result = await handleOAuthCallback(provider, { code, state });

    // Set secure HTTP-only session cookie
    setAuthCookie(res, result.token);

    // Redirect to frontend dashboard with token parameter for fallback sync
    const destination = result.redirectUrl && result.redirectUrl.startsWith('/') ? result.redirectUrl : '/dashboard';
    return res.redirect(`${appUrl}${destination}?token=${encodeURIComponent(result.token)}`);
  } catch (err) {
    console.error(`OAuth callback error for ${provider}:`, err);
    return res.redirect(`${appUrl}/signup?error=${encodeURIComponent(err.message || 'OAuth authentication failed.')}`);
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
