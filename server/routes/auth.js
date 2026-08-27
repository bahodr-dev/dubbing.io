import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { authenticateToken, JWT_SECRET } from '../middleware/auth.js';

export const authRouter = Router();

// Helper to create JWT token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Format user output (strip password_hash)
function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email.split('@')[0],
    provider: user.provider || 'email',
    avatarUrl: user.avatar_url || '',
    createdAt: user.created_at,
  };
}

// 1. SIGN UP (Email + Password)
authRouter.post('/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Check if user already exists
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const userId = randomUUID();
    const displayName = name || cleanEmail.split('@')[0];

    db.prepare(`
      INSERT INTO users (id, email, name, password_hash, provider)
      VALUES (?, ?, ?, ?, 'email')
    `).run(userId, cleanEmail, displayName, passwordHash);

    const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const token = generateToken(newUser);

    return res.status(201).json({
      token,
      user: formatUser(newUser),
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
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

    if (!user) {
      return res.status(401).json({ error: 'No account found with this email. Please check your email or sign up.' });
    }

    if (!user.password_hash) {
      return res.status(400).json({ error: `This account was registered using ${user.provider}. Please use ${user.provider} to log in.` });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password. Please try again or reset your password.' });
    }

    const token = generateToken(user);

    return res.json({
      token,
      user: formatUser(user),
      message: 'Logged in successfully!',
    });
  } catch (err) {
    console.error('Error in /signin:', err);
    return res.status(500).json({ error: 'Internal server error during sign in.' });
  }
});

// 3. OAUTH (Google, GitHub, SSO)
authRouter.post('/oauth', async (req, res) => {
  try {
    const { email, name, provider, avatarUrl } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required for OAuth login.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);

    if (!user) {
      const userId = randomUUID();
      const displayName = name || cleanEmail.split('@')[0];
      const authProvider = provider || 'oauth';

      db.prepare(`
        INSERT INTO users (id, email, name, provider, avatar_url)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, cleanEmail, displayName, authProvider, avatarUrl || '');

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    }

    const token = generateToken(user);

    return res.json({
      token,
      user: formatUser(user),
      message: `Signed in with ${provider || 'OAuth'} successfully!`,
    });
  } catch (err) {
    console.error('Error in /oauth:', err);
    return res.status(500).json({ error: 'Internal server error during OAuth login.' });
  }
});

// 4. GET CURRENT AUTHENTICATED USER
authRouter.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json({ user: formatUser(user) });
  } catch (err) {
    console.error('Error in /me:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});
