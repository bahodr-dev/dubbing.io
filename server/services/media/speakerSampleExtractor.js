import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const DEFAULT_MIN_SAMPLE_SECONDS = 10;
const DEFAULT_MAX_SAMPLE_SECONDS = 30;
const DEFAULT_MIN_CLIP_SECONDS = 2;
const DEFAULT_EDGE_TRIM_SECONDS = 0.2;
const DEFAULT_TIMEOUT_MS = 120_000;

function mergeIntervals(intervals) {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

function subtractIntervals(base, blockers) {
  let pieces = [base];
  for (const blocker of blockers) {
    pieces = pieces.flatMap((piece) => {
      if (blocker.end <= piece.start || blocker.start >= piece.end) return [piece];
      const remaining = [];
      if (blocker.start > piece.start) remaining.push({ start: piece.start, end: blocker.start });
      if (blocker.end < piece.end) remaining.push({ start: blocker.end, end: piece.end });
      return remaining;
    });
    if (pieces.length === 0) break;
  }
  return pieces;
}

/** Select speech intervals without overlapping another or unidentified speaker. */
export function planSpeakerSamples(segments, {
  minSampleSeconds = DEFAULT_MIN_SAMPLE_SECONDS,
  maxSampleSeconds = DEFAULT_MAX_SAMPLE_SECONDS,
  minClipSeconds = DEFAULT_MIN_CLIP_SECONDS,
  edgeTrimSeconds = DEFAULT_EDGE_TRIM_SECONDS,
} = {}) {
  if (!Array.isArray(segments)) throw new Error('Transcript segments are required to extract speaker samples.');
  if (!(minSampleSeconds > 0 && maxSampleSeconds >= minSampleSeconds && minClipSeconds > 0 && edgeTrimSeconds >= 0)) {
    throw new Error('Invalid speaker sample duration settings.');
  }

  const intervals = segments.flatMap((segment) => {
    const start = segment?.startTime ?? segment?.start;
    const end = segment?.endTime ?? segment?.end;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    const speaker = typeof segment.speaker === 'string' ? segment.speaker.trim() : '';
    return [{ start, end, speaker }];
  });
  const speakers = [...new Set(intervals.map((interval) => interval.speaker).filter(Boolean))];
  const ready = [];
  const insufficient = [];

  for (const speaker of speakers) {
    const ownIntervals = mergeIntervals(intervals.filter((interval) => interval.speaker === speaker));
    const blockers = mergeIntervals(intervals
      .filter((interval) => interval.speaker !== speaker)
      .map((interval) => ({
        start: Math.max(0, interval.start - edgeTrimSeconds),
        end: interval.end + edgeTrimSeconds,
      })));
    const cleanPieces = ownIntervals.flatMap((interval) => {
      const trimmed = {
        start: interval.start + edgeTrimSeconds,
        end: interval.end - edgeTrimSeconds,
      };
      if (trimmed.end <= trimmed.start) return [];
      return subtractIntervals(trimmed, blockers);
    }).filter((interval) => interval.end - interval.start >= minClipSeconds);

    const selected = [];
    let totalSeconds = 0;
    for (const interval of [...cleanPieces].sort((a, b) => (b.end - b.start) - (a.end - a.start))) {
      const usableSeconds = Math.min(interval.end - interval.start, maxSampleSeconds - totalSeconds);
      if (usableSeconds < minClipSeconds) break;
      selected.push({ start: interval.start, end: interval.start + usableSeconds });
      totalSeconds += usableSeconds;
      if (totalSeconds >= maxSampleSeconds) break;
    }

    if (totalSeconds < minSampleSeconds) {
      insufficient.push({ speaker, availableSeconds: totalSeconds });
    } else {
      ready.push({
        speaker,
        clips: selected.sort((a, b) => a.start - b.start),
        durationSeconds: totalSeconds,
      });
    }
  }

  return { ready, insufficient };
}

function runFfmpeg(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(process.env.FFMPEG_PATH || 'ffmpeg', args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let settled = false;
    let stderr = '';
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(() => {
      ffmpeg.kill('SIGKILL');
      finish(new Error('Speaker sample extraction timed out.'));
    }, timeoutMs);
    ffmpeg.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-2000); });
    ffmpeg.on('error', (error) => finish(new Error(`Speaker sample extraction could not start: ${error.message}`)));
    ffmpeg.on('close', (code) => finish(code === 0 ? null : new Error(`Speaker sample extraction failed: ${stderr.slice(-400)}`)));
  });
}

/** Produce short-lived, one-file-per-speaker WAV samples for a cloning provider. */
export async function extractSpeakerSamples({ sourceFilePath, segments, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!sourceFilePath || !fs.existsSync(sourceFilePath)) {
    throw new Error('Source media is missing for speaker sample extraction.');
  }
  const plan = planSpeakerSamples(segments);
  if (plan.ready.length === 0) return { samples: [], insufficient: plan.insufficient, cleanup: () => {} };

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dubla-speaker-samples-'));
  fs.chmodSync(tempDir, 0o700);
  const cleanup = () => fs.rmSync(tempDir, { recursive: true, force: true });

  try {
    const samples = [];
    for (const [index, speakerPlan] of plan.ready.entries()) {
      const outputPath = path.join(tempDir, `speaker-${index + 1}.wav`);
      const sourceLabels = speakerPlan.clips.map((_, clipIndex) => `[source${clipIndex}]`);
      const filterParts = speakerPlan.clips.length > 1
        ? [`[0:a]asplit=${speakerPlan.clips.length}${sourceLabels.join('')}`]
        : [];
      filterParts.push(...speakerPlan.clips.map((clip, clipIndex) =>
        `${speakerPlan.clips.length > 1 ? sourceLabels[clipIndex] : '[0:a]'}atrim=start=${clip.start.toFixed(3)}:end=${clip.end.toFixed(3)},asetpts=PTS-STARTPTS[clip${clipIndex}]`
      ));
      const clipInputs = speakerPlan.clips.map((_, clipIndex) => `[clip${clipIndex}]`).join('');
      filterParts.push(`${clipInputs}concat=n=${speakerPlan.clips.length}:v=0:a=1[out]`);
      await runFfmpeg([
        '-nostdin', '-y', '-i', sourceFilePath, '-filter_complex', filterParts.join(';'),
        '-map', '[out]', '-vn', '-ac', '1', '-ar', '24000', '-c:a', 'pcm_s16le', outputPath,
      ], timeoutMs);
      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size <= 44) {
        throw new Error(`No usable audio was extracted for ${speakerPlan.speaker}.`);
      }
      samples.push({
        speaker: speakerPlan.speaker,
        filePath: outputPath,
        durationSeconds: speakerPlan.durationSeconds,
        clipCount: speakerPlan.clips.length,
      });
    }
    return { samples, insufficient: plan.insufficient, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}
