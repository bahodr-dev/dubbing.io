import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { renderDubbedMedia, hasAudioStream } from '../services/media/dubbingRenderer.js';
import { uploadsDir } from '../db.js';

describe('Dubbing Renderer Service', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects audio stream existence correctly', async () => {
    // If file does not exist, returns false safely
    const exists = await hasAudioStream('/tmp/non_existent_file_test.mp4');
    expect(exists).toBe(false);
  });

  it('rejects rendering when source media is missing', async () => {
    await expect(renderDubbedMedia({
      sourceFilePath: '/tmp/missing-source.mp4',
      segmentAudioFiles: [{ filePath: '/tmp/seg1.mp3', startTime: 0, endTime: 2 }],
    })).rejects.toThrow(/Source media is missing/i);
  });

  it('rejects rendering when segment audio files array is empty', async () => {
    const tempSource = path.join(uploadsDir, `test-source-${Date.now()}.mp4`);
    fs.writeFileSync(tempSource, 'dummy source content');

    try {
      await expect(renderDubbedMedia({
        sourceFilePath: tempSource,
        segmentAudioFiles: [],
      })).rejects.toThrow(/No synthesized segment audio is available/i);
    } finally {
      if (fs.existsSync(tempSource)) fs.unlinkSync(tempSource);
    }
  });
});
