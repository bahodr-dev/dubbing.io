import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { validateMediaFile, checkMagicBytes, MAX_UPLOAD_SIZE_BYTES } from '../services/media/mediaValidator.js';

describe('Media Validator Unit Tests', () => {
  const tempDir = path.join(os.tmpdir(), `test_media_val_${Date.now()}`);
  let validWavPath = '';
  let validMp4Path = '';
  let fakeExePath = '';
  let zeroBytePath = '';
  let oversizedPath = '';

  beforeAll(() => {
    fs.mkdirSync(tempDir, { recursive: true });

    // 1. Valid WAV header (RIFF ... WAVE)
    validWavPath = path.join(tempDir, 'valid_audio.wav');
    const wavBuffer = Buffer.alloc(44);
    wavBuffer.write('RIFF', 0);
    wavBuffer.writeUInt32LE(36, 4);
    wavBuffer.write('WAVE', 8);
    wavBuffer.write('fmt ', 12);
    fs.writeFileSync(validWavPath, wavBuffer);

    // 2. Valid MP4 header (ftyp box)
    validMp4Path = path.join(tempDir, 'valid_video.mp4');
    const mp4Buffer = Buffer.alloc(32);
    mp4Buffer.writeUInt32BE(32, 0);
    mp4Buffer.write('ftypisom', 4);
    fs.writeFileSync(validMp4Path, mp4Buffer);

    // 3. Fake renamed script / executable
    fakeExePath = path.join(tempDir, 'fake_malicious.mp4');
    fs.writeFileSync(fakeExePath, '#!/bin/bash\necho "exploit"');

    // 4. Zero byte file
    zeroBytePath = path.join(tempDir, 'zero_byte.mp4');
    fs.writeFileSync(zeroBytePath, Buffer.alloc(0));

    // 5. Oversized mock file path (virtual check)
    oversizedPath = path.join(tempDir, 'oversized.mp4');
    fs.writeFileSync(oversizedPath, Buffer.alloc(100));
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  it('1. Recognizes valid WAV magic bytes and audio mediaType', () => {
    const result = validateMediaFile({ filePath: validWavPath });
    expect(result.isValid).toBe(true);
    expect(result.mediaType).toBe('audio');
    expect(result.detectedFormat).toBe('wav');
  });

  it('2. Recognizes valid MP4 container and video mediaType', () => {
    const result = validateMediaFile({ filePath: validMp4Path });
    expect(result.isValid).toBe(true);
    expect(result.mediaType).toBe('video');
  });

  it('3. Rejects empty (0-byte) files', () => {
    const result = validateMediaFile({ filePath: zeroBytePath });
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  it('4. Rejects disallowed extensions (e.g. .exe, .sh, .txt)', () => {
    const txtPath = path.join(tempDir, 'document.txt');
    fs.writeFileSync(txtPath, 'some text');
    const result = validateMediaFile({ filePath: txtPath });
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/invalid file extension/i);
  });

  it('5. Rejects files exceeding max allowed size limit', () => {
    const result = validateMediaFile({
      filePath: oversizedPath,
      maxSizeBytes: 50, // lower limit to trigger rejection
    });
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/exceeds the maximum allowed limit/i);
  });

  it('6. Detects and rejects malicious script/shell headers disguised with video extension', () => {
    const result = validateMediaFile({ filePath: fakeExePath });
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/executable\/script detected/i);
  });

  it('7. Handles missing file gracefully', () => {
    const missing = path.join(tempDir, 'non_existent.mp4');
    const result = validateMediaFile({ filePath: missing });
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/does not exist/i);
  });
});
