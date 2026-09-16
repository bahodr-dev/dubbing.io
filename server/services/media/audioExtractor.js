import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { randomUUID } from 'crypto';

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const DEFAULT_TIMEOUT_MS = parseInt(process.env.FFMPEG_TIMEOUT_MS || '60000', 10);

// Dedicated temp directory for audio extraction
const TEMP_DIR = path.join(os.tmpdir(), 'dubbing_audio_temp');
if (!fs.existsSync(TEMP_DIR)) {
  try {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  } catch (_) {}
}

/**
 * Checks if FFmpeg binary is accessible on the host system
 */
export async function isFfmpegAvailable() {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG_PATH, ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

/**
 * Safely removes a temporary file from disk without throwing
 */
export function cleanupTempFile(filePath) {
  if (!filePath || typeof filePath !== 'string') return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    // Ignore cleanup error or log debug
  }
}

/**
 * Extracts audio from video/audio file into 16kHz mono WAV format suitable for Whisper / ASR
 *
 * @param {Object} options
 * @param {string} options.inputFilePath - Absolute path to input media file
 * @param {number} [options.sampleRate=16000] - Audio sample rate in Hz
 * @param {number} [options.channels=1] - Number of audio channels (1 for mono)
 * @param {number} [options.timeoutMs=60000] - Extraction timeout in ms
 * @returns {Promise<{ audioFilePath: string, sampleRate: number, channels: number, cleanup: () => void }>}
 */
export async function extractAudioFromMedia({
  inputFilePath,
  sampleRate = 16000,
  channels = 1,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!inputFilePath || !fs.existsSync(inputFilePath)) {
    throw new Error('Input media file does not exist on disk.');
  }

  const outputFilename = `extract-${Date.now()}-${randomUUID().slice(0, 8)}.wav`;
  const outputFilePath = path.join(TEMP_DIR, outputFilename);

  // FFmpeg arguments safely passed as array (no shell interpolation)
  const args = [
    '-y',                     // Overwrite output files without asking
    '-i', inputFilePath,      // Input media file
    '-vn',                    // Disable video recording / extraction
    '-ac', String(channels),  // Set number of audio channels (1 = mono)
    '-ar', String(sampleRate),// Set audio sampling rate (16000 Hz)
    '-c:a', 'pcm_s16le',      // 16-bit uncompressed PCM WAV
    '-f', 'wav',              // WAV container format
    outputFilePath,
  ];

  return new Promise((resolve, reject) => {
    let proc;
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      if (proc) {
        try {
          proc.kill('SIGKILL');
        } catch (_) {}
      }
      cleanupTempFile(outputFilePath);
      reject(new Error(`FFmpeg audio extraction timed out after ${(timeoutMs / 1000).toFixed(0)} seconds.`));
    }, timeoutMs);

    try {
      proc = spawn(FFMPEG_PATH, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } catch (spawnErr) {
      clearTimeout(timer);
      cleanupTempFile(outputFilePath);
      return reject(new Error(`Failed to spawn FFmpeg process: ${spawnErr.message}`));
    }

    let stderrOutput = '';
    proc.stderr.on('data', (chunk) => {
      stderrOutput += chunk.toString();
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      cleanupTempFile(outputFilePath);
      if (err.code === 'ENOENT') {
        reject(new Error('FFmpeg is not installed or not found in system PATH.'));
      } else {
        reject(new Error(`FFmpeg process error: ${err.message}`));
      }
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (timedOut) return;

      if (code !== 0) {
        cleanupTempFile(outputFilePath);
        const snippet = stderrOutput.slice(-300).trim();
        reject(new Error(`FFmpeg audio extraction failed with exit code ${code}. ${snippet}`));
        return;
      }

      if (!fs.existsSync(outputFilePath) || fs.statSync(outputFilePath).size === 0) {
        cleanupTempFile(outputFilePath);
        reject(new Error('FFmpeg finished but output audio file is missing or empty (no audio track found in media).'));
        return;
      }

      resolve({
        audioFilePath: outputFilePath,
        sampleRate,
        channels,
        cleanup: () => cleanupTempFile(outputFilePath),
      });
    });
  });
}
