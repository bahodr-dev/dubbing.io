import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { extractSpeakerSamples, planSpeakerSamples } from '../services/media/speakerSampleExtractor.js';

describe('Speaker sample extraction', () => {
  it('excludes overlapping and unidentified speech from each speaker sample', () => {
    const result = planSpeakerSamples([
      { startTime: 0, endTime: 12, speaker: 'Speaker 1' },
      { startTime: 8, endTime: 10, speaker: 'Speaker 2' },
      { startTime: 12, endTime: 27, speaker: 'Speaker 2' },
      { startTime: 17, endTime: 19 },
      { startTime: 27, endTime: 38, speaker: 'Speaker 1' },
    ]);

    expect(result.ready.map((entry) => entry.speaker)).toEqual(['Speaker 1', 'Speaker 2']);
    for (const entry of result.ready) {
      for (const clip of entry.clips) {
        expect(clip.end).toBeGreaterThan(clip.start);
        expect(clip.end <= 7.8 || clip.start >= 10.2).toBe(true);
        expect(clip.end <= 16.8 || clip.start >= 19.2).toBe(true);
      }
    }
    expect(result.ready.find((entry) => entry.speaker === 'Speaker 1').clips)
      .toEqual([{ start: 0.2, end: 7.8 }, { start: 27.2, end: 37.8 }]);
  });

  it('does not mark a speaker with too little clean speech as ready', () => {
    const result = planSpeakerSamples([
      { startTime: 0, endTime: 15, speaker: 'Speaker 1' },
      { startTime: 15, endTime: 18, speaker: 'Speaker 2' },
    ]);

    expect(result.ready.map((entry) => entry.speaker)).toEqual(['Speaker 1']);
    expect(result.insufficient[0].speaker).toBe('Speaker 2');
    expect(result.insufficient[0].availableSeconds).toBeLessThan(10);
  });

  it('writes separate temporary WAV files and removes them on cleanup', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dubla-speaker-test-'));
    const sourceFilePath = path.join(tempDir, 'source.wav');
    let extracted;
    try {
      const generated = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', [
        '-nostdin', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=26',
        '-ac', '1', '-ar', '24000', sourceFilePath,
      ], { stdio: 'ignore' });
      expect(generated.status).toBe(0);

      extracted = await extractSpeakerSamples({
        sourceFilePath,
        segments: [
          { startTime: 0, endTime: 12, speaker: 'Speaker 1' },
          { startTime: 13, endTime: 25, speaker: 'Speaker 2' },
        ],
      });

      expect(extracted.samples.map((sample) => sample.speaker)).toEqual(['Speaker 1', 'Speaker 2']);
      expect(extracted.samples.every((sample) => fs.statSync(sample.filePath).size > 44)).toBe(true);
    } finally {
      extracted?.cleanup();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    expect(extracted.samples.every((sample) => !fs.existsSync(sample.filePath))).toBe(true);
  });
});
