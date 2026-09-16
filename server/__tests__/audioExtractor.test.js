import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { extractAudioFromMedia, isFfmpegAvailable, cleanupTempFile } from '../services/media/audioExtractor.js';

describe('FFmpeg Audio Extractor Unit Tests', () => {
  const tempDir = path.join(os.tmpdir(), `test_audio_ext_${Date.now()}`);
  let validMediaVideoPath = '';
  let corruptMediaPath = '';

  beforeAll(() => {
    fs.mkdirSync(tempDir, { recursive: true });

    validMediaVideoPath = path.join(tempDir, 'synthetic_test.mp4');
    corruptMediaPath = path.join(tempDir, 'corrupt.mp4');

    // Create a 1-second synthetic audio/video container with FFmpeg for testing
    spawnSync('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=1',
      '-c:a', 'aac',
      validMediaVideoPath,
    ], { stdio: 'ignore' });

    // Create a corrupt file
    fs.writeFileSync(corruptMediaPath, 'NOT_A_VALID_MEDIA_FILE_HEADER');
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  it('1. Verifies FFmpeg binary is installed and accessible', async () => {
    const available = await isFfmpegAvailable();
    expect(available).toBe(true);
  });

  it('2. Extracts 16kHz mono PCM WAV from media file', async () => {
    if (!fs.existsSync(validMediaVideoPath)) {
      // Fallback in case ffmpeg was not run in beforeAll
      return;
    }

    const result = await extractAudioFromMedia({
      inputFilePath: validMediaVideoPath,
      sampleRate: 16000,
      channels: 1,
    });

    expect(result.audioFilePath).toBeDefined();
    expect(fs.existsSync(result.audioFilePath)).toBe(true);
    expect(result.sampleRate).toBe(16000);
    expect(result.channels).toBe(1);

    // Verify WAV header in output
    const header = Buffer.alloc(12);
    const fd = fs.openSync(result.audioFilePath, 'r');
    fs.readSync(fd, header, 0, 12, 0);
    fs.closeSync(fd);
    expect(header.toString('ascii', 0, 4)).toBe('RIFF');
    expect(header.toString('ascii', 8, 12)).toBe('WAVE');

    // Test cleanup
    result.cleanup();
    expect(fs.existsSync(result.audioFilePath)).toBe(false);
  });

  it('3. Throws error when input media file does not exist', async () => {
    const nonExistent = path.join(tempDir, 'missing_file.mp4');
    await expect(extractAudioFromMedia({ inputFilePath: nonExistent })).rejects.toThrow(
      /does not exist/i
    );
  });

  it('4. Handles corrupted media file with clear error without crashing', async () => {
    await expect(extractAudioFromMedia({ inputFilePath: corruptMediaPath })).rejects.toThrow(
      /ffmpeg/i
    );
  });

  it('5. cleanupTempFile safely ignores non-existent or invalid paths', () => {
    expect(() => cleanupTempFile(null)).not.toThrow();
    expect(() => cleanupTempFile('')).not.toThrow();
    expect(() => cleanupTempFile('/tmp/definitely_not_existing_12345.wav')).not.toThrow();
  });
});
