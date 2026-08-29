import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { uploadsDir, db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import * as mediaRepository from '../repositories/mediaRepository.js';

export const mediaRouter = Router();

const MAX_UPLOAD_SIZE_BYTES = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || '', 10) || 250 * 1024 * 1024; // 250 MB default

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
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
});

// Helper for multer error handling wrapper
function uploadSingleFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: `File size exceeds the limit of ${(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB.`,
        });
      }
      return res.status(400).json({ error: err.message || 'File upload error.' });
    }
    next();
  });
}

// 1. UPLOAD MEDIA FILE (Authenticated & Owned)
mediaRouter.post('/upload', authenticateToken, uploadSingleFile, (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No media file provided.' });
    }

    const { projectId } = req.body;
    let validatedProjectId = null;

    // If projectId provided, verify user ownership of the project
    if (projectId) {
      const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user.id);
      if (!project) {
        // Clean up uploaded file if project ownership check fails
        try { fs.unlinkSync(req.file.path); } catch (_) {}
        return res.status(404).json({ error: 'Project not found or unauthorized.' });
      }
      validatedProjectId = project.id;
    }

    const mediaType = req.file.mimetype.startsWith('audio/') ? 'audio' : 'video';

    // Insert database ownership record
    const asset = mediaRepository.createMediaAsset({
      userId: req.user.id,
      projectId: validatedProjectId,
      originalFilename: req.file.originalname,
      storedFilename: req.file.filename,
      storagePath: req.file.path,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      mediaType,
      status: 'ready',
    });

    const formatted = mediaRepository.formatMedia(asset);

    return res.status(201).json({
      ...formatted,
      filename: req.file.filename, // For backwards compatibility
      message: 'Media uploaded successfully!',
    });
  } catch (err) {
    console.error('Error uploading media:', err);
    return res.status(500).json({ error: 'Failed to upload media file.' });
  }
});

// 2. GET / STREAM PRIVATE MEDIA (Authenticated, Range Support, Ownership-Enforced)
mediaRouter.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const media = mediaRepository.findByIdAndUser(id, req.user.id);

    if (!media) {
      return res.status(404).json({ error: 'Media not found.' });
    }

    // Path traversal check
    const storageRoot = path.resolve(uploadsDir);
    const safeFilePath = path.resolve(storageRoot, media.stored_filename);
    if (!safeFilePath.startsWith(storageRoot + path.sep) && safeFilePath !== storageRoot) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (!fs.existsSync(safeFilePath)) {
      return res.status(404).json({ error: 'Media file not found on disk.' });
    }

    const stat = fs.statSync(safeFilePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (isNaN(start) || start >= fileSize || (parts[1] && end < start)) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).json({ error: 'Requested range not satisfiable' });
      }

      const chunkSize = end - start + 1;
      const fileStream = fs.createReadStream(safeFilePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': media.mime_type || 'application/octet-stream',
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': media.mime_type || 'application/octet-stream',
        'Accept-Ranges': 'bytes',
      });
      fs.createReadStream(safeFilePath).pipe(res);
    }
  } catch (err) {
    console.error('Error streaming media:', err);
    return res.status(500).json({ error: 'Failed to stream media file.' });
  }
});

// 3. DOWNLOAD PRIVATE MEDIA (Authenticated with sanitized Content-Disposition)
mediaRouter.get('/:id/download', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const media = mediaRepository.findByIdAndUser(id, req.user.id);

    if (!media) {
      return res.status(404).json({ error: 'Media not found.' });
    }

    const storageRoot = path.resolve(uploadsDir);
    const safeFilePath = path.resolve(storageRoot, media.stored_filename);
    if (!safeFilePath.startsWith(storageRoot + path.sep) && safeFilePath !== storageRoot) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    if (!fs.existsSync(safeFilePath)) {
      return res.status(404).json({ error: 'Media file not found on disk.' });
    }

    const sanitizedFilename = (media.original_filename || 'download').replace(/[^a-zA-Z0-9._-]/g, '_');
    const stat = fs.statSync(safeFilePath);

    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': media.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
    });

    fs.createReadStream(safeFilePath).pipe(res);
  } catch (err) {
    console.error('Error downloading media:', err);
    return res.status(500).json({ error: 'Failed to download media file.' });
  }
});

// 4. DELETE PRIVATE MEDIA (Authenticated & Owner Only)
mediaRouter.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const media = mediaRepository.findByIdAndUser(id, req.user.id);

    if (!media) {
      return res.status(404).json({ error: 'Media not found.' });
    }

    // 1. Delete database record
    mediaRepository.deleteMediaAsset(id, req.user.id);

    // 2. Delete physical file from filesystem safely
    const storageRoot = path.resolve(uploadsDir);
    const safeFilePath = path.resolve(storageRoot, media.stored_filename);
    if (safeFilePath.startsWith(storageRoot + path.sep) && fs.existsSync(safeFilePath)) {
      try {
        fs.unlinkSync(safeFilePath);
      } catch (_) {}
    }

    return res.json({ message: 'Media deleted successfully.' });
  } catch (err) {
    console.error('Error deleting media:', err);
    return res.status(500).json({ error: 'Failed to delete media file.' });
  }
});

// 5. PARSE VIDEO URL (Authenticated with oEmbed metadata resolver)
mediaRouter.post('/extract-url', authenticateToken, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Video URL is required.' });
    }

    let parsedTitle = 'Web Video Stream';
    let thumbnailUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80';
    let duration = 30;

    // Fetch real metadata via oEmbed
    try {
      const oembedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        if (data.title) parsedTitle = data.title;
        if (data.thumbnail_url) thumbnailUrl = data.thumbnail_url;
      }
    } catch (_) {}

    if (parsedTitle === 'Web Video Stream') {
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        parsedTitle = 'YouTube Video Stream';
        thumbnailUrl = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80';
      } else if (url.includes('vimeo.com')) {
        parsedTitle = 'Vimeo Studio Stream';
        thumbnailUrl = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80';
      }
    }

    return res.json({
      url,
      title: parsedTitle,
      thumbnailUrl,
      duration,
      message: 'Video metadata resolved successfully!',
    });
  } catch (err) {
    console.error('Error extracting URL:', err);
    return res.status(500).json({ error: 'Failed to parse video URL.' });
  }
});
