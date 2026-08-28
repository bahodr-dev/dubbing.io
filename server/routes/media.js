import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { uploadsDir } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

export const mediaRouter = Router();

const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.mp3', '.wav', '.aac', '.ogg', '.m4a']);
const ALLOWED_MIMES = new Set([
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
  'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/aac', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'
]);

// Configure Multer storage with strict extension validation and UUID naming
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(rawExt) ? rawExt : '.mp4';
    const uniqueId = randomUUID();
    cb(null, `media-${Date.now()}-${uniqueId}${safeExt}`);
  },
});

// Strict file filter for permitted audio and video files
const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext) && (ALLOWED_MIMES.has(file.mimetype) || file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/'))) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only standard video (MP4, MOV, WEBM, MKV) and audio (MP3, WAV, AAC, OGG, M4A) formats are permitted.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 250 * 1024 * 1024 }, // 250 MB limit
});

// 1. UPLOAD MEDIA FILE (Authenticated)
mediaRouter.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No media file provided.' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const fileSizeMb = (req.file.size / (1024 * 1024)).toFixed(1) + ' MB';

    return res.status(201).json({
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: fileSizeMb,
      mimeType: req.file.mimetype,
      message: 'Media uploaded successfully!',
    });
  } catch (err) {
    console.error('Error uploading media:', err);
    return res.status(500).json({ error: 'Failed to upload media file.' });
  }
});

// 2. PARSE VIDEO URL (Authenticated)
mediaRouter.post('/extract-url', authenticateToken, (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Video URL is required.' });
    }

    let parsedTitle = 'Web Video Stream';
    let thumbnailUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80';
    let duration = 30;

    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      parsedTitle = 'YouTube Video Import';
      thumbnailUrl = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80';
    } else if (url.includes('vimeo.com')) {
      parsedTitle = 'Vimeo Studio Stream';
      thumbnailUrl = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80';
    }

    return res.json({
      url,
      title: parsedTitle,
      thumbnailUrl,
      duration,
      message: 'Video URL parsed successfully!',
    });
  } catch (err) {
    console.error('Error extracting URL:', err);
    return res.status(500).json({ error: 'Failed to parse video URL.' });
  }
});
