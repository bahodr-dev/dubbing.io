import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { getMediaDuration } from '../services/media/durationDetector.js';

describe('Media Duration Detector Unit Tests (getMediaDuration)', () => {
  const tempDir = path.join(os.tmpdir(), `test_duration_detector_${Date.now()}`);
  let valid10sVideoPath = '';
  let valid35sVideoPath = '';
  let pathWithSpaces = '';
  let corruptMediaPath = '';

  beforeAll(() => {
    fs.mkdirSync(tempDir, { recursive: true });

    valid10sVideoPath = path.join(tempDir, 'synthetic_10s.mp4');
    valid35sVideoPath = path.join(tempDir, 'synthetic_35s.mp4');
    pathWithSpaces = path.join(tempDir, 'synthetic video with spaces.mp4');
    corruptMediaPath = path.join(tempDir, 'corrupt_media.mp4');

    // Create a 10-second synthetic audio container with FFmpeg
    spawnSync('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=10',
      '-c:a', 'aac',
      valid10sVideoPath,
    ], { stdio: 'ignore' });

    // Create a 35-second synthetic audio container with FFmpeg
    spawnSync('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=35',
      '-c:a', 'aac',
      valid35sVideoPath,
    ], { stdio: 'ignore' });

    // Create a file with spaces in filename (5 seconds)
    spawnSync('ffmpeg', [
      '-y',
      '-f', 'lavfi',
      '-i', 'sine=frequency=440:duration=5',
      '-c:a', 'aac',
      pathWithSpaces,
    ], { stdio: 'ignore' });

    // Create a corrupt non-media file
    fs.writeFileSync(corruptMediaPath, 'CORRUPT_NOT_A_VALID_MEDIA_FILE_CONTENT_XYZ');
  });

  afterAll(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  it('1. Accurately detects duration of a 10-second media file', async () => {
    const duration = await getMediaDuration(valid10sVideoPath);
    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThanOrEqual(9.9);
    expect(duration).toBeLessThanOrEqual(10.2);
  });

  it('2. Accurately detects duration of a 35-second media file (>30s)', async () => {
    const duration = await getMediaDuration(valid35sVideoPath);
    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThanOrEqual(34.8);
    expect(duration).toBeLessThanOrEqual(35.3);
  });

  it('3. Safely handles file paths containing spaces without shell interpolation errors', async () => {
    const duration = await getMediaDuration(pathWithSpaces);
    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThanOrEqual(4.9);
    expect(duration).toBeLessThanOrEqual(5.2);
  });

  it('4. Rejects non-existent media file with safe descriptive error', async () => {
    const missingPath = path.join(tempDir, 'does_not_exist_9999.mp4');
    await expect(getMediaDuration(missingPath)).rejects.toThrow(
      /Media file does not exist on disk/i
    );
  });

  it('5. Rejects null or empty filePath input', async () => {
    await expect(getMediaDuration(null)).rejects.toThrow(
      /File path is required/i
    );
    await expect(getMediaDuration('')).rejects.toThrow(
      /File path is required/i
    );
  });

  it('6. Rejects corrupt or invalid media file with safe application error', async () => {
    await expect(getMediaDuration(corruptMediaPath)).rejects.toThrow(
      /Unable to determine media duration/i
    );
  });

  it('7. Rejects when probe times out', async () => {
    // 1ms timeout will reliably trigger timeout rejection
    await expect(getMediaDuration(valid10sVideoPath, { timeoutMs: 1 })).rejects.toThrow(
      /timed out|Unable to determine media duration/i
    );
  });
});
