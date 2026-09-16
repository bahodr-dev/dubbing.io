import { spawn } from 'child_process';
import fs from 'fs';

const FFPROBE_PATH = process.env.FFPROBE_PATH || 'ffprobe';
const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.FFPROBE_TIMEOUT_MS || '15000', 10);

/**
 * Probes media duration using ffprobe with JSON output
 *
 * @param {string} filePath - Absolute path to media file
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<number>}
 */
function probeWithFfprobe(filePath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      filePath,
    ];

    let proc;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      if (proc) {
        try { proc.kill('SIGKILL'); } catch (_) {}
      }
      reject(new Error(`FFprobe probe timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    try {
      proc = spawn(FFPROBE_PATH, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      clearTimeout(timer);
      return reject(err);
    }

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code !== 0) {
        return reject(new Error(`FFprobe exited with code ${code}: ${stderr.trim()}`));
      }

      try {
        const data = JSON.parse(stdout);
        const durationStr = data?.format?.duration;
        const durationNum = parseFloat(durationStr);

        if (typeof durationNum === 'number' && !isNaN(durationNum) && durationNum > 0) {
          return resolve(durationNum);
        }
        reject(new Error('FFprobe did not return a valid positive duration.'));
      } catch (parseErr) {
        reject(new Error(`Failed to parse FFprobe JSON output: ${parseErr.message}`));
      }
    });
  });
}

/**
 * Fallback duration probing using ffmpeg -i inspection
 *
 * @param {string} filePath - Absolute path to media file
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<number>}
 */
function probeWithFfmpeg(filePath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const args = ['-i', filePath];

    let proc;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      if (proc) {
        try { proc.kill('SIGKILL'); } catch (_) {}
      }
      reject(new Error(`FFmpeg probe timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    try {
      proc = spawn(FFMPEG_PATH, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (err) {
      clearTimeout(timer);
      return reject(err);
    }

    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', () => {
      clearTimeout(timer);
      if (timedOut) return;

      // FFmpeg outputs stream information to stderr including: Duration: 00:01:23.45, start: ...
      const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (match) {
        const hours = parseFloat(match[1]);
        const minutes = parseFloat(match[2]);
        const seconds = parseFloat(match[3]);
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;

        if (!isNaN(totalSeconds) && totalSeconds > 0) {
          return resolve(totalSeconds);
        }
      }
      reject(new Error('Unable to parse duration from FFmpeg output.'));
    });
  });
}

/**
 * Accurately detects the real duration of a media file in seconds.
 *
 * @param {string} filePath - Absolute path to local media file
 * @param {Object} [options]
 * @param {number} [options.timeoutMs] - Optional custom timeout in ms
 * @returns {Promise<number>} - Duration in seconds
 */
export async function getMediaDuration(filePath, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Unable to determine media duration: File path is required.');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error('Unable to determine media duration: Media file does not exist on disk.');
  }

  // 1. Primary: ffprobe
  try {
    const dur = await probeWithFfprobe(filePath, timeoutMs);
    return Math.round(dur * 100) / 100;
  } catch (probeErr) {
    // 2. Secondary fallback: ffmpeg -i
    try {
      const dur = await probeWithFfmpeg(filePath, timeoutMs);
      return Math.round(dur * 100) / 100;
    } catch (_) {
      throw new Error('Unable to determine media duration.');
    }
  }
}
