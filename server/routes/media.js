import { cinemaCapabilities } from '../services/cinema.js';
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import { lookup } from 'dns/promises';
import { randomUUID } from 'crypto';
import { uploadsDir, db } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';
import * as mediaRepository from '../repositories/mediaRepository.js';
import {
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_SIZE_BYTES,
  safeMimeTypeForExtension,
  validateMediaFile,
} from '../services/media/mediaValidator.js';
import { getMediaDuration } from '../services/media/durationDetector.js';

export const mediaRouter = Router();

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

// Multer performs an early extension check; binary validation happens after
// writing via validateMediaFile because client-provided MIME types are spoofable.
const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) {
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

function removeUploadedFile(file) {
  if (!file?.path) return;
  try {
    fs.unlinkSync(file.path);
  } catch (err) {
    if (err?.code !== 'ENOENT') {
      console.error('Could not remove rejected upload:', err);
    }
  }
}

function getSafeMediaPath(storedFilename) {
  const storageRoot = path.resolve(uploadsDir);
  const safeFilePath = path.resolve(storageRoot, storedFilename || '');
  return safeFilePath.startsWith(storageRoot + path.sep) ? safeFilePath : null;
}

const EXTENSION_BY_MIME_TYPE = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-matroska': '.mkv',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/webm': '.webm',
  'audio/aac': '.aac',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
};

function isPrivateAddress(address) {
  const normalized = address.toLowerCase();
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  const ipv4 = normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
  const parts = ipv4.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [first, second] = parts;
  return first === 0 || first === 10 || first === 127 || first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168);
}

async function assertPublicRemoteUrl(remoteUrl) {
  if (!['http:', 'https:'].includes(remoteUrl.protocol)) {
    throw new Error('Only HTTP and HTTPS media URLs are supported.');
  }
  const hostname = remoteUrl.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Local network URLs are not permitted.');
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('The media URL must resolve to a public internet host.');
  }
}

async function fetchPublicMedia(initialUrl) {
  let remoteUrl = new URL(initialUrl);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    await assertPublicRemoteUrl(remoteUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    let response;
    try {
      response = await fetch(remoteUrl, { redirect: 'manual', signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('The media server returned an invalid redirect.');
      remoteUrl = new URL(location, remoteUrl);
      continue;
    }
    if (!response.ok || !response.body) {
      throw new Error(`Could not download the media file (HTTP ${response.status}).`);
    }
    return { response, remoteUrl };
  }
  throw new Error('The media URL redirected too many times.');
}

// 1. UPLOAD MEDIA FILE (Authenticated & Owned)
mediaRouter.post('/upload', authenticateToken, uploadSingleFile, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No media file provided.' });
    }

    const { projectId } = req.body;
    let validatedProjectId = null;

    if (projectId !== undefined && (typeof projectId !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(projectId))) {
      removeUploadedFile(req.file);
      return res.status(400).json({ error: 'projectId has an invalid format.' });
    }

    const fileValidation = validateMediaFile({
      filePath: req.file.path,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
    });
    if (!fileValidation.isValid) {
      removeUploadedFile(req.file);
      return res.status(400).json({ error: fileValidation.error });
    }

    let serverDuration = null;
    if (process.env.NODE_ENV !== 'test') {
      try {
        serverDuration = await getMediaDuration(req.file.path);
      } catch (_) {
        removeUploadedFile(req.file);
        return res.status(422).json({ error: 'The uploaded file is corrupt, has no playable media, or its duration cannot be read.', code: 'MEDIA_DURATION_INVALID' });
      }
      const maxDuration = cinemaCapabilities(req.user.id).enabled
        ? Number.parseInt(process.env.MAX_FILM_DURATION_SECONDS || '21600', 10)
        : Number.parseInt(process.env.MAX_MEDIA_DURATION_SECONDS || '900', 10);
      if (serverDuration > maxDuration) {
        removeUploadedFile(req.file);
        return res.status(422).json({ error: `Media is longer than the ${Math.floor(maxDuration / 60)} minute beta limit.`, code: 'MEDIA_DURATION_EXCEEDED' });
      }
    }

    // If projectId provided, verify user ownership of the project
    if (projectId) {
      const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user.id);
      if (!project) {
        removeUploadedFile(req.file);
        return res.status(404).json({ error: 'Project not found or unauthorized.' });
      }
      validatedProjectId = project.id;
    }

    const mediaType = fileValidation.mediaType;
    const safeMimeType = safeMimeTypeForExtension(fileValidation.extension);

    // Insert database ownership record
    const asset = mediaRepository.createMediaAsset({
      userId: req.user.id,
      projectId: validatedProjectId,
      originalFilename: req.file.originalname,
      storedFilename: req.file.filename,
      storagePath: req.file.path,
      mimeType: safeMimeType,
      sizeBytes: req.file.size,
      mediaType,
      status: 'ready',
    });

    const formatted = mediaRepository.formatMedia(asset);

    return res.status(201).json({
      ...formatted,
      duration: serverDuration,
      filename: req.file.filename, // For backwards compatibility
      message: 'Media uploaded successfully!',
    });
  } catch (err) {
    removeUploadedFile(req.file);
    console.error('Error uploading media:', err);
    return res.status(500).json({ error: 'Failed to upload media file.' });
  }
});

// 2. IMPORT A DIRECT, PUBLIC MEDIA FILE URL. Embedded platform pages (such as
// YouTube or Vimeo) are intentionally not downloaded; users must provide a
// direct file URL or upload media they are entitled to process.
mediaRouter.post('/import-url', authenticateToken, async (req, res) => {
  let storedPath = null;
  try {
    const { url } = req.body;
    if (typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'A public direct audio or video file URL is required.' });
    }

    let initialUrl;
    try {
      initialUrl = new URL(url.trim());
    } catch (_) {
      return res.status(400).json({ error: 'Provide a valid HTTP or HTTPS link to a media file.' });
    }

    const { response, remoteUrl } = await fetchPublicMedia(initialUrl.toString());
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_UPLOAD_SIZE_BYTES) {
      return res.status(400).json({ error: `Remote file exceeds the ${(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)).toFixed(0)} MB limit.` });
    }

    const mimeType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const pathnameExtension = path.extname(remoteUrl.pathname).toLowerCase();
    const extension = ALLOWED_EXTENSIONS.has(pathnameExtension)
      ? pathnameExtension
      : EXTENSION_BY_MIME_TYPE[mimeType];
    if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
      return res.status(400).json({ error: 'URL must point directly to a supported audio or video file. Video page links cannot be imported.' });
    }

    const sourceName = path.basename(remoteUrl.pathname) || `remote-media${extension}`;
    const originalFilename = sourceName.endsWith(extension) ? sourceName : `${sourceName}${extension}`;
    const storedFilename = `media-${Date.now()}-${randomUUID()}${extension}`;
    storedPath = path.join(uploadsDir, storedFilename);
    const destination = fs.createWriteStream(storedPath, { flags: 'wx', mode: 0o600 });
    const stream = Readable.fromWeb(response.body);
    let downloadedBytes = 0;

    await new Promise((resolve, reject) => {
      stream.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (downloadedBytes > MAX_UPLOAD_SIZE_BYTES) {
          stream.destroy(new Error('Remote file exceeds the upload size limit.'));
        }
      });
      stream.on('error', reject);
      destination.on('error', reject);
      destination.on('finish', resolve);
      stream.pipe(destination);
    });

    const validation = validateMediaFile({
      filePath: storedPath,
      originalFilename,
      mimeType: EXTENSION_BY_MIME_TYPE[mimeType] ? mimeType : safeMimeTypeForExtension(extension),
      maxSizeBytes: MAX_UPLOAD_SIZE_BYTES,
    });
    if (!validation.isValid) {
      fs.unlinkSync(storedPath);
      storedPath = null;
      return res.status(400).json({ error: validation.error });
    }

    const asset = mediaRepository.createMediaAsset({
      userId: req.user.id,
      originalFilename,
      storedFilename,
      storagePath: storedPath,
      mimeType: safeMimeTypeForExtension(extension),
      sizeBytes: validation.sizeBytes,
      mediaType: validation.mediaType,
      status: 'ready',
    });
    storedPath = null;
    return res.status(201).json({ ...mediaRepository.formatMedia(asset), message: 'Remote media imported successfully.' });
  } catch (err) {
    if (storedPath && fs.existsSync(storedPath)) {
      try { fs.unlinkSync(storedPath); } catch (_) {}
    }
    console.error('Error importing remote media:', err);
    return res.status(400).json({ error: err.message || 'Could not import the remote media file.' });
  }
});

// 3. GET / STREAM PRIVATE MEDIA (Authenticated, Range Support, Ownership-Enforced)
mediaRouter.get('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const media = mediaRepository.findByIdAndUser(id, req.user.id);

    if (!media) {
      return res.status(404).json({ error: 'Media not found.' });
    }

    // Path traversal check
    const safeFilePath = getSafeMediaPath(media.stored_filename);
    if (!safeFilePath) {
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

    const safeFilePath = getSafeMediaPath(media.stored_filename);
    if (!safeFilePath) {
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

    // Delete the private file first. If it cannot be deleted, retain the DB
    // record so an administrator can retry rather than silently orphaning data.
    const safeFilePath = getSafeMediaPath(media.stored_filename);
    if (!safeFilePath) {
      return res.status(403).json({ error: 'Access denied.' });
    }
    if (fs.existsSync(safeFilePath)) {
      try {
        fs.unlinkSync(safeFilePath);
      } catch (err) {
        console.error('Could not delete media file:', err);
        return res.status(500).json({ error: 'Could not delete the media file. Please try again.' });
      }
    }

    mediaRepository.deleteMediaAsset(id, req.user.id);

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
    if (typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'Video URL is required.' });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url.trim());
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported protocol');
    } catch (_) {
      return res.status(400).json({ error: 'Provide a valid HTTP or HTTPS video URL.' });
    }

    let parsedTitle = 'Web Video Stream';
    let thumbnailUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80';
    let duration = 30;

    // Fetch real metadata via oEmbed
    try {
      const oembedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(parsedUrl.toString())}`);
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        if (data.title) parsedTitle = data.title;
        if (data.thumbnail_url) thumbnailUrl = data.thumbnail_url;
      }
    } catch (_) {}

    if (parsedTitle === 'Web Video Stream') {
      if (parsedUrl.hostname.includes('youtube.com') || parsedUrl.hostname === 'youtu.be') {
        parsedTitle = 'YouTube Video Stream';
        thumbnailUrl = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80';
      } else if (parsedUrl.hostname.includes('vimeo.com')) {
        parsedTitle = 'Vimeo Studio Stream';
        thumbnailUrl = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80';
      }
    }

    return res.json({
      url: parsedUrl.toString(),
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
