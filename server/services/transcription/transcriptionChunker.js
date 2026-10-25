import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';
import { getMediaDuration } from '../media/durationDetector.js';

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const DEFAULT_CHUNK_SECONDS = 600; // 10 minutes per chunk ensures audio stays well under 25 MB

function runFfmpegSlice({ inputPath, outputPath, startSeconds, durationSeconds, timeoutMs = 60000 }) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-ss', String(startSeconds),
      '-t', String(durationSeconds),
      '-i', inputPath,
      '-c:a', 'copy',
      outputPath,
    ];

    let proc;
    let stderr = '';
    const timer = setTimeout(() => {
      try { proc?.kill('SIGKILL'); } catch {}
      reject(new Error('Audio chunking operation timed out.'));
    }, timeoutMs);

    try {
      proc = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (err) {
      clearTimeout(timer);
      return reject(err);
    }

    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        resolve();
      } else {
        reject(new Error(`Audio chunking failed (${code}): ${stderr.slice(-300).trim()}`));
      }
    });
  });
}

/**
 * Splits an audio file into manageable chunks for transcription providers
 * with file size limits (like OpenAI's 25 MB limit).
 *
 * @param {Object} options
 * @param {string} options.audioFilePath - Path to local audio file
 * @param {number} [options.totalDuration] - Optional pre-known total duration in seconds
 * @param {number} [options.chunkDurationSeconds=600] - Duration of each chunk in seconds (default 10 mins)
 * @returns {Promise<{ chunks: Array<{ filePath: string, offsetSeconds: number, duration: number }>, cleanup: () => void }>}
 */
export async function splitAudioIntoChunks({
  audioFilePath,
  totalDuration,
  chunkDurationSeconds = DEFAULT_CHUNK_SECONDS,
} = {}) {
  if (!audioFilePath || !fs.existsSync(audioFilePath)) {
    throw new Error('Audio file does not exist for chunking.');
  }

  const duration = Number.isFinite(totalDuration) && totalDuration > 0
    ? totalDuration
    : await getMediaDuration(audioFilePath);

  if (duration <= chunkDurationSeconds) {
    return {
      chunks: [{ filePath: audioFilePath, offsetSeconds: 0, duration }],
      cleanup: () => {},
    };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `dubla-tx-chunks-${randomUUID().slice(0, 8)}-`));
  const cleanup = () => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  };

  const ext = path.extname(audioFilePath) || '.mp3';
  const chunks = [];
  let currentStart = 0;
  let chunkIndex = 0;

  try {
    while (currentStart < duration) {
      const sliceDuration = Math.min(chunkDurationSeconds, duration - currentStart);
      const chunkPath = path.join(tempDir, `chunk_${chunkIndex}${ext}`);
      await runFfmpegSlice({
        inputPath: audioFilePath,
        outputPath: chunkPath,
        startSeconds: currentStart,
        durationSeconds: sliceDuration,
      });

      chunks.push({
        filePath: chunkPath,
        offsetSeconds: currentStart,
        duration: sliceDuration,
      });

      currentStart += sliceDuration;
      chunkIndex += 1;
    }

    return { chunks, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}
