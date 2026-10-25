import { Router } from 'express';
import { db } from '../db.js';
import { authenticateOptional, authenticateToken } from '../middleware/auth.js';

export const voicesRouter = Router();

// 1. GET ALL VOICES (with optional filtering)
voicesRouter.get('/', authenticateOptional, (req, res) => {
  try {
    const { language, gender } = req.query;

    let query = 'SELECT * FROM voices';
    const params = [];
    const conditions = ['(user_id IS NULL OR user_id = ?)'];
    params.push(req.user?.id || '');

    if (language) {
      conditions.push('language_code = ?');
      params.push(language);
    }
    if (gender) {
      conditions.push('gender = ?');
      params.push(gender);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY recommended DESC, name ASC';

    const rows = db.prepare(query).all(...params);

    const formatted = rows.map(v => ({
      id: v.id,
      name: v.name,
      language: v.language,
      languageCode: v.language_code,
      style: v.style,
      gender: v.gender,
      tone: v.tone,
      previewUrl: v.preview_url || '',
      tags: v.tags_json ? JSON.parse(v.tags_json) : [],
      recommended: Boolean(v.recommended),
      isCustom: Boolean(v.is_custom),
    }));

    return res.json({ voices: formatted });
  } catch (err) {
    console.error('Error fetching voices:', err);
    return res.status(500).json({ error: 'Failed to fetch voice profiles.' });
  }
});

// Legacy endpoint created a profile without a real cloned voice. Keep an
// explicit response so callers do not mistake that profile for a usable clone.
voicesRouter.post('/clone', authenticateToken, (_req, res) => {
  return res.status(410).json({
    error: 'Standalone voice profiles are no longer created. Enable automatic voice cloning in the dubbing studio and confirm speaker permission.',
  });
});
