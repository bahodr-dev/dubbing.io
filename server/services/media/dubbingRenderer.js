import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { uploadsDir } from '../../db.js';
import { getMediaDuration } from './durationDetector.js';
import { cadenceTargetDuration, validateSpeechCadence } from '../speechCadence.js';

const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || 'ffprobe';
const RENDER_TIMEOUT_MS = parseInt(process.env.FFMPEG_RENDER_TIMEOUT_MS || '900000', 10);
const MAX_SEGMENTS_PER_FFMPEG_PASS = 25;

export async function hasAudioStream(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  return new Promise((resolve) => {
    const proc = spawn(FFPROBE_PATH, [
      '-v', 'error',
      '-select_streams', 'a',
      '-show_entries', 'stream=codec_type',
      '-of', 'json',
      filePath,
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => {
      if (code !== 0) return resolve(false);
      try {
        const json = JSON.parse(stdout);
        resolve(Array.isArray(json?.streams) && json.streams.length > 0);
      } catch {
        resolve(false);
      }
    });
  });
}

export function runFfmpeg(args, timeoutMs = RENDER_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let processHandle;
    let stderr = '';
    let settled = false;

    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };

    const timer = setTimeout(() => {
      try { processHandle?.kill('SIGKILL'); } catch {}
      finish(() => reject(new Error('Dubbed media rendering timed out.')));
    }, timeoutMs);

    try {
      processHandle = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (error) {
      finish(() => reject(error));
      return;
    }

    processHandle.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
    });
    processHandle.on('error', (error) => {
      finish(() => reject(error.code === 'ENOENT'
        ? new Error('FFmpeg is not installed or is not available in PATH.')
        : error));
    });
    processHandle.on('close', (code) => {
      finish(() => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg rendering failed (${code}): ${stderr.slice(-500).trim()}`));
      });
    });
  });
}

function buildAtempoChain(factor) {
  // Clamped between 0.7x and 1.45x to maintain human voice texture and prevent chipmunk/robotic distortion
  const clampedFactor = Math.max(0.7, Math.min(1.45, factor));
  const filters = [];
  let remaining = clampedFactor;
  while (remaining > 2) {
    filters.push('atempo=2');
    remaining /= 2;
  }
  while (remaining < 0.5) {
    filters.push('atempo=0.5');
    remaining /= 0.5;
  }
  filters.push(`atempo=${remaining.toFixed(5)}`);
  return filters.join(',');
}

function safeOutputName(value, fallback) {
  const cleaned = String(value || fallback)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return cleaned || fallback;
}

async function renderSpeechPass({ segments, sourceDuration, outputPath, timeoutMs }) {
  const inputArgs = segments.flatMap((segment) => ['-i', segment.filePath]);
  const filters = segments.map((segment, index) => {
    const targetDuration = segment.cadenceDuration;
    const tempoFactor = segment.audioDuration / targetDuration;
    const delayMs = Math.max(0, Math.round(segment.startTime * 1000));
    return `[${index}:a]aresample=48000,${buildAtempoChain(tempoFactor)},adelay=${delayMs}:all=1,apad,atrim=0:${sourceDuration.toFixed(3)}[seg${index}]`;
  });
  const mixInputs = segments.map((_, index) => `[seg${index}]`).join('');
  filters.push(`${mixInputs}amix=inputs=${segments.length}:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95,atrim=0:${sourceDuration.toFixed(3)}[dubbed]`);

  await runFfmpeg([
    '-y',
    ...inputArgs,
    '-filter_complex', filters.join(';'),
    '-map', '[dubbed]',
    '-c:a', 'aac',
    '-b:a', '192k',
    outputPath,
  ], timeoutMs);
}

async function renderSynthesizedSpeechTrack({ usableSegments, sourceDuration, destinationPath, timeoutMs }) {
  if (usableSegments.length <= MAX_SEGMENTS_PER_FFMPEG_PASS) {
    await renderSpeechPass({
      segments: usableSegments,
      sourceDuration,
      outputPath: destinationPath,
      timeoutMs,
    });
    return;
  }

  // Chunked rendering to prevent command-line argument overflows and file-descriptor limits
  const chunkFiles = [];
  try {
    for (let i = 0; i < usableSegments.length; i += MAX_SEGMENTS_PER_FFMPEG_PASS) {
      const chunk = usableSegments.slice(i, i + MAX_SEGMENTS_PER_FFMPEG_PASS);
      const chunkFile = path.join(uploadsDir, `subdub-${randomUUID().slice(0, 8)}.m4a`);
      chunkFiles.push(chunkFile);
      await renderSpeechPass({
        segments: chunk,
        sourceDuration,
        outputPath: chunkFile,
        timeoutMs,
      });
    }

    const inputArgs = chunkFiles.flatMap((filePath) => ['-i', filePath]);
    const mixInputs = chunkFiles.map((_, index) => `[${index}:a]`).join('');
    const mixFilter = `${mixInputs}amix=inputs=${chunkFiles.length}:duration=longest:dropout_transition=0:normalize=0,alimiter=limit=0.95,atrim=0:${sourceDuration.toFixed(3)}[master_dubbed]`;

    await runFfmpeg([
      '-y',
      ...inputArgs,
      '-filter_complex', mixFilter,
      '-map', '[master_dubbed]',
      '-c:a', 'aac',
      '-b:a', '192k',
      destinationPath,
    ], timeoutMs);
  } finally {
    for (const tempChunk of chunkFiles) {
      try { if (fs.existsSync(tempChunk)) fs.unlinkSync(tempChunk); } catch {}
    }
  }
}

export async function renderDubbedMedia({
  sourceFilePath,
  segmentAudioFiles,
  totalDuration,
  projectTitle,
  renderVideo = true,
  enableDucking = true,
  speechCadence = 'natural',
  qualityMode = 'standard',
  backgroundFilePath = null,
} = {}) {
  validateSpeechCadence(speechCadence);
  if (!sourceFilePath || !fs.existsSync(sourceFilePath)) {
    throw new Error('Source media is missing for dubbed media rendering.');
  }
  if (!Array.isArray(segmentAudioFiles) || segmentAudioFiles.length === 0) {
    throw new Error('No synthesized segment audio is available for rendering.');
  }

  if (qualityMode === 'cinema' && (!backgroundFilePath || !fs.existsSync(backgroundFilePath))) {
    throw new Error('Cinema requires the separated background track.');
  }
  const usableSegments = [];
  for (const segment of segmentAudioFiles) {
    if (!segment?.filePath || !fs.existsSync(segment.filePath)) continue;
    const startTime = Number(segment.startTime);
    const endTime = Number(segment.endTime);
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) continue;
    const audioDuration = await getMediaDuration(segment.filePath);
    usableSegments.push({ ...segment, startTime, endTime, audioDuration });
  }

  if (usableSegments.length === 0) {
    throw new Error('Synthesized segment audio could not be aligned to the timeline.');
  }

  const sourceDuration = Number.isFinite(totalDuration) && totalDuration > 0
    ? totalDuration
    : await getMediaDuration(sourceFilePath);
  for (const segment of usableSegments) {
    segment.cadenceDuration = cadenceTargetDuration(segment, usableSegments, sourceDuration, speechCadence);
    if (qualityMode === 'cinema') {
      const window = Math.min(segment.endTime, sourceDuration) - segment.startTime;
      segment.cadenceDuration = Math.min(segment.cadenceDuration, window);
      if (window <= 0 || segment.audioDuration / segment.cadenceDuration > 1.45 + 0.001) {
        throw new Error('Cinema speech does not fit its time window. Shorten the translation.');
      }
      // Short utterances retain natural pauses; never stretch into another speaker.
      segment.cadenceDuration = Math.min(segment.cadenceDuration, segment.audioDuration / 0.7);
    }
  }
  const outputId = randomUUID().slice(0, 12);
  const baseName = safeOutputName(projectTitle, 'dubbed-project');
  const isolatedSpeechFilename = `${baseName}-speech-${outputId}.m4a`;
  const audioFilename = `${baseName}-dubbed-${outputId}.m4a`;
  const videoFilename = `${baseName}-dubbed-${outputId}.mp4`;

  const isolatedSpeechPath = path.join(uploadsDir, isolatedSpeechFilename);
  const audioFilePath = path.join(uploadsDir, audioFilename);
  const videoFilePath = path.join(uploadsDir, videoFilename);

  try {
    // 1. Render all synthesized speech segments onto the timeline
    await renderSynthesizedSpeechTrack({
      usableSegments,
      sourceDuration,
      destinationPath: isolatedSpeechPath,
      timeoutMs: RENDER_TIMEOUT_MS,
    });

    // 2. Determine if the source has audio that should be ducked and preserved
    const sourceHasAudio = await hasAudioStream(sourceFilePath);
    if (qualityMode === 'cinema') {
      await runFfmpeg(['-y', '-i', backgroundFilePath, '-i', isolatedSpeechPath,
        '-filter_complex', `[0:a]aresample=48000[bg];[bg][1:a]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95,apad,atrim=0:${sourceDuration.toFixed(3)}[final]`,
        '-map', '[final]', '-c:a', 'aac', '-b:a', '192k', audioFilePath]);
    } else if (sourceHasAudio && enableDucking) {
      try {
        // Professional sidechain audio ducking:
        // Duck the background music/SFX during speech intervals, restore between phrases
        const duckingFilter = [
          '[0:a]aresample=48000,volume=0.85[orig]',
          '[1:a]aresample=48000[dubbed]',
          '[orig][dubbed]sidechaincompress=threshold=0.03:ratio=6:attack=15:release=350[bg_ducked]',
          `[bg_ducked][dubbed]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95,atrim=0:${sourceDuration.toFixed(3)}[final]`,
        ].join(';');

        await runFfmpeg([
          '-y',
          '-i', sourceFilePath,
          '-i', isolatedSpeechPath,
          '-filter_complex', duckingFilter,
          '-map', '[final]',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', '+faststart',
          audioFilePath,
        ]);
      } catch (duckingErr) {
        console.warn('[DubbingRenderer] Sidechain ducking failed, falling back to clean speech track:', duckingErr.message);
        fs.copyFileSync(isolatedSpeechPath, audioFilePath);
      }
    } else {
      fs.copyFileSync(isolatedSpeechPath, audioFilePath);
    }

    // 3. Mux into final MP4 video if requested
    if (renderVideo) {
      await runFfmpeg([
        '-y',
        '-i', sourceFilePath,
        '-i', audioFilePath,
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '20',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-shortest',
        '-movflags', '+faststart',
        videoFilePath,
      ]);
    }

    return {
      duration: sourceDuration,
      audioFilePath,
      audioFilename,
      audioSizeBytes: fs.statSync(audioFilePath).size,
      videoFilePath: renderVideo ? videoFilePath : null,
      videoFilename: renderVideo ? videoFilename : null,
      videoSizeBytes: renderVideo ? fs.statSync(videoFilePath).size : null,
    };
  } catch (error) {
    for (const target of [audioFilePath, videoFilePath]) {
      try { if (fs.existsSync(target)) fs.unlinkSync(target); } catch {}
    }
    throw error;
  } finally {
    try { if (fs.existsSync(isolatedSpeechPath)) fs.unlinkSync(isolatedSpeechPath); } catch {}
  }
}
