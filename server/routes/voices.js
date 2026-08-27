import { Router } from 'express';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export const voicesRouter = Router();

// 1. GET ALL VOICES (with optional filtering)
voicesRouter.get('/', (req, res) => {
  try {
    const { language, gender } = req.query;

    let query = 'SELECT * FROM voices';
    const params = [];
    const conditions = [];

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

// 2. CLONE CUSTOM VOICE (Authenticated)
voicesRouter.post('/clone', authenticateToken, (req, res) => {
  try {
    const { name, language, languageCode, gender, style, tone, tags, previewUrl } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Voice name is required.' });
    }

    const voiceId = `voice-custom-${randomUUID().slice(0, 8)}`;
    const voiceLang = language || 'Uzbek';
    const voiceLangCode = languageCode || 'uz';

    db.prepare(`
      INSERT INTO voices (
        id, user_id, name, language, language_code, style, 
        gender, tone, preview_url, tags_json, recommended, is_custom
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1)
    `).run(
      voiceId,
      req.user.id,
      name,
      voiceLang,
      voiceLangCode,
      style || 'Natural',
      gender || 'male',
      tone || 'Custom cloned neural profile',
      previewUrl || '',
      tags ? JSON.stringify(tags) : JSON.stringify(['Custom', 'Cloned'])
    );

    const newVoice = db.prepare('SELECT * FROM voices WHERE id = ?').get(voiceId);

    return res.status(201).json({
      voice: {
        id: newVoice.id,
        name: newVoice.name,
        language: newVoice.language,
        languageCode: newVoice.language_code,
        style: newVoice.style,
        gender: newVoice.gender,
        tone: newVoice.tone,
        previewUrl: newVoice.preview_url,
        tags: JSON.parse(newVoice.tags_json),
        recommended: false,
        isCustom: true,
      },
      message: 'Custom voice cloned successfully!',
    });
  } catch (err) {
    console.error('Error cloning voice:', err);
    return res.status(500).json({ error: 'Failed to clone voice.' });
  }
});
