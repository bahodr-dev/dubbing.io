import fs from 'fs';
import path from 'path';

export const MAX_UPLOAD_SIZE_BYTES = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES || '', 10) || 250 * 1024 * 1024; // 250 MB default

export const ALLOWED_EXTENSIONS = new Set([
  '.mp4', '.mov', '.webm', '.mkv',
  '.mp3', '.wav', '.aac', '.ogg', '.m4a'
]);

export const ALLOWED_MIME_TYPES = new Set([
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/aac', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'
]);

/**
 * Inspects buffer header bytes to check if the file matches known media signatures (magic bytes)
 */
export function checkMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return false;

  // 1. WAV ("RIFF" ... "WAVE")
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WAVE') {
    return { detected: true, format: 'wav', mediaType: 'audio' };
  }

  // 2. OGG ("OggS")
  if (buffer.toString('ascii', 0, 4) === 'OggS') {
    return { detected: true, format: 'ogg', mediaType: 'audio' };
  }

  // 3. WebM / Matroska (EBML: 0x1A 0x45 0xDF 0xA3)
  if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
    return { detected: true, format: 'webm/mkv', mediaType: 'video' };
  }

  // 4. MP4 / MOV / M4A (ftyp box usually at offset 4..8)
  if (buffer.length >= 12) {
    const boxType = buffer.toString('ascii', 4, 8);
    if (boxType === 'ftyp' || boxType === 'moov' || boxType === 'mdat' || boxType === 'free' || boxType === 'wide') {
      return { detected: true, format: 'mp4/mov', mediaType: 'video' };
    }
  }

  // 5. MP3 (ID3 tag or sync word 0xFF 0xFB / 0xFF 0xF3 / 0xFF 0xF2 / 0xFF 0xFA)
  if (buffer.toString('ascii', 0, 3) === 'ID3') {
    return { detected: true, format: 'mp3/id3', mediaType: 'audio' };
  }
  if (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0) {
    return { detected: true, format: 'mp3/aac', mediaType: 'audio' };
  }

  // 6. QuickTime alternative signature (first 4 bytes size, followed by 'moov' or 'mdat' or 'skip')
  if (buffer.length >= 8) {
    const qtTag = buffer.toString('ascii', 4, 8);
    if (['moov', 'mdat', 'pnot', 'skip', 'wide'].includes(qtTag)) {
      return { detected: true, format: 'quicktime', mediaType: 'video' };
    }
  }

  return { detected: false };
}

/**
 * Validates a media file comprehensively (file existence, size, extension, MIME, magic bytes)
 */
export function validateMediaFile({
  filePath,
  originalFilename = '',
  mimeType = '',
  maxSizeBytes = MAX_UPLOAD_SIZE_BYTES,
} = {}) {
  if (!filePath || typeof filePath !== 'string') {
    return { isValid: false, error: 'File path is required.' };
  }

  if (!fs.existsSync(filePath)) {
    return { isValid: false, error: 'Media file does not exist on disk.' };
  }

  let stats;
  try {
    stats = fs.statSync(filePath);
  } catch (err) {
    return { isValid: false, error: `Failed to inspect media file: ${err.message}` };
  }

  if (stats.size === 0) {
    return { isValid: false, error: 'File is empty (0 bytes).' };
  }

  if (stats.size > maxSizeBytes) {
    const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return {
      isValid: false,
      error: `File size (${(stats.size / (1024 * 1024)).toFixed(1)} MB) exceeds the maximum allowed limit of ${maxMb} MB.`,
    };
  }

  const filenameToEvaluate = originalFilename || path.basename(filePath);
  const ext = path.extname(filenameToEvaluate).toLowerCase();

  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return {
      isValid: false,
      error: `Invalid file extension (${ext || 'unknown'}). Allowed extensions: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}.`,
    };
  }

  if (mimeType) {
    const normalizedMime = mimeType.toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(normalizedMime) && !normalizedMime.startsWith('video/') && !normalizedMime.startsWith('audio/')) {
      return {
        isValid: false,
        error: `Invalid MIME type (${mimeType}). Only standard video and audio formats are permitted.`,
      };
    }
  }

  // Header magic byte inspection (read first 64 bytes)
  try {
    const fd = fs.openSync(filePath, 'r');
    const headerBuffer = Buffer.alloc(64);
    const bytesRead = fs.readSync(fd, headerBuffer, 0, 64, 0);
    fs.closeSync(fd);

    if (bytesRead >= 4) {
      const magicResult = checkMagicBytes(headerBuffer.subarray(0, bytesRead));
      // If we couldn't match a strict magic signature, but extension is standard and size > 0, log caution
      // but if it has obvious text/HTML/shell script signatures, reject it
      const headerText = headerBuffer.subarray(0, bytesRead).toString('utf8');
      if (
        headerText.startsWith('<!DOCTYPE') ||
        headerText.startsWith('<html') ||
        headerText.startsWith('<?php') ||
        headerText.startsWith('#!/bin') ||
        headerText.startsWith('MZ') // Windows PE executable
      ) {
        return {
          isValid: false,
          error: 'File content does not match a valid audio or video format (executable/script detected).',
        };
      }

      const mediaType = ext.match(/\.(mp3|wav|aac|ogg|m4a)$/i) ? 'audio' : 'video';

      return {
        isValid: true,
        sizeBytes: stats.size,
        extension: ext,
        mediaType: magicResult.mediaType || mediaType,
        detectedFormat: magicResult.format || ext.replace('.', ''),
      };
    }
  } catch (err) {
    return { isValid: false, error: `Failed to inspect file binary header: ${err.message}` };
  }

  const mediaType = ext.match(/\.(mp3|wav|aac|ogg|m4a)$/i) ? 'audio' : 'video';
  return {
    isValid: true,
    sizeBytes: stats.size,
    extension: ext,
    mediaType,
  };
}
