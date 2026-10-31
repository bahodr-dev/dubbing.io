import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { renderDubbedMedia, hasAudioStream } from '../services/media/dubbingRenderer.js';
import { uploadsDir } from '../db.js';
import { spawnSync } from 'child_process';
import { randomUUID } from 'crypto';
import { getMediaDuration } from '../services/media/durationDetector.js';

describe('Dubbing Renderer Service', () => {
  it('renders audibly different cadence lengths without changing the overall video timeline', async () => {
    const source = path.join(uploadsDir, `cadence-source-${randomUUID()}.wav`);
    const speech = path.join(uploadsDir, `cadence-tone-${randomUUID()}.wav`);
    const files = [source, speech];
    try {
      expect(spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '4', source], { stdio: 'ignore' }).status).toBe(0);
      expect(spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', speech], { stdio: 'ignore' }).status).toBe(0);
      const endings = {};
      for (const cadence of ['natural', 'fast', 'narrative']) {
        const result = await renderDubbedMedia({
          sourceFilePath: source, segmentAudioFiles: [{ filePath: speech, startTime: 0, endTime: 2 }],
          totalDuration: 4, renderVideo: false, enableDucking: false, speechCadence: cadence,
        });
        files.push(result.audioFilePath);
        expect(await getMediaDuration(result.audioFilePath)).toBeCloseTo(4, 1);
        const detect = spawnSync('ffmpeg', ['-i', result.audioFilePath, '-af', 'silencedetect=noise=-40dB:d=0.1', '-f', 'null', '-'], { encoding: 'utf8' });
        expect(detect.status).toBe(0);
        const matches = [...detect.stderr.matchAll(/silence_start: ([\d.]+)/g)];
        expect(matches.length).toBeGreaterThan(0);
        endings[cadence] = Number(matches.at(-1)[1]);
      }
      expect(endings.fast).toBeLessThan(endings.natural - 0.15);
      expect(endings.narrative).toBeGreaterThan(endings.natural + 0.15);
    } finally {
      for (const file of files) if (fs.existsSync(file)) fs.unlinkSync(file);
    }
  }, 30000);
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
