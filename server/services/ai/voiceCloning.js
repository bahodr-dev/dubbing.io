import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { db, uploadsDir } from '../../db.js';
import { extractSpeakerSamples, planSpeakerSamples } from '../media/speakerSampleExtractor.js';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

export function canCloneVoices() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

/** Compare the editable transcript with server-owned diarization evidence. */
export function verifyProjectDiarization({ userId, projectId, mediaId, segments, allowSpeakerCorrections = false } = {}) {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error('Transcribe the source video before automatic voice cloning.');
  }
  const transcription = db.prepare(`
    SELECT id FROM transcription_jobs
    WHERE project_id = ? AND user_id = ? AND media_id = ? AND status = 'completed'
    ORDER BY created_at DESC, rowid DESC LIMIT 1
  `).get(projectId, userId, mediaId);
  if (!transcription) throw new Error('A completed speaker-labeled transcription is required for voice cloning.');
  const evidence = db.prepare(`
    SELECT id, start_time, end_time, speaker, speaker_source
    FROM transcript_segments WHERE job_id = ?
  `).all(transcription.id);
  if (evidence.length !== segments.length || evidence.length === 0) {
    throw new Error('The transcript no longer matches the identified speakers. Re-transcribe the video.');
  }
  const byId = new Map(evidence.map((segment) => [segment.id, segment]));
  for (const segment of segments) {
    const trusted = byId.get(segment?.id);
    if (!trusted || trusted.speaker_source !== 'diarization' || !trusted.speaker ||
        (!allowSpeakerCorrections && segment.speaker !== trusted.speaker) ||
        (allowSpeakerCorrections && (typeof segment.speaker !== 'string' || !segment.speaker.trim())) ||
        !Number.isFinite(segment.startTime) || !Number.isFinite(segment.endTime) ||
        Math.abs(segment.startTime - trusted.start_time) > 0.01 ||
        Math.abs(segment.endTime - trusted.end_time) > 0.01) {
      throw new Error('Speaker labels could not be verified. Re-transcribe the video before cloning voices.');
    }
  }
}

export async function createInstantVoiceClone({ filePath, name, fetchClient = globalThis.fetch } = {}) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is required for automatic voice cloning.');
  if (!filePath || !fs.existsSync(filePath)) throw new Error('A speaker audio sample is required for cloning.');

  const formData = new FormData();
  formData.append('name', name);
  formData.append('files[]', new Blob([fs.readFileSync(filePath)], { type: 'audio/wav' }), 'speaker.wav');
  const response = await fetchClient(`${ELEVENLABS_BASE_URL}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: formData,
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`Voice cloning provider rejected the sample (${response.status}).`);
  const result = await response.json();
  if (typeof result.voice_id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(result.voice_id)) {
    throw new Error('Voice cloning provider returned an invalid voice ID.');
  }
  return { providerVoiceId: result.voice_id, requiresVerification: result.requires_verification === true };
}

export async function deleteInstantVoiceClone(providerVoiceId, { fetchClient = globalThis.fetch } = {}) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is required to remove a cloned voice.');
  if (!/^[a-zA-Z0-9_-]+$/.test(providerVoiceId || '')) throw new Error('Invalid cloned voice ID.');
  const response = await fetchClient(`${ELEVENLABS_BASE_URL}/voices/${providerVoiceId}`, {
    method: 'DELETE',
    headers: { 'xi-api-key': apiKey },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Voice cloning provider could not remove a clone (${response.status}).`);
  }
}

/** Remove provider clones after a job; failed deletions remain recorded for retry. */
export async function cleanupJobVoiceClones(jobId) {
  const rows = db.prepare('SELECT id, provider_voice_id FROM job_voice_clones WHERE job_id = ? AND deleted_at IS NULL').all(jobId);
  const failures = [];
  for (const row of rows) {
    try {
      await deleteInstantVoiceClone(row.provider_voice_id);
      db.prepare('UPDATE job_voice_clones SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?').run(row.id);
    } catch (error) {
      failures.push({ id: row.id, error: error.message });
    }
  }
  return failures;
}

export async function cleanupTerminalVoiceClones() {
  const jobs = db.prepare(`
    SELECT DISTINCT c.job_id
    FROM job_voice_clones c
    JOIN dubbing_jobs j ON j.id = c.job_id
    WHERE c.deleted_at IS NULL AND j.status IN ('completed', 'failed')
    LIMIT 20
  `).all();
  const failures = [];
  for (const job of jobs) failures.push(...await cleanupJobVoiceClones(job.job_id));
  return failures;
}

/** Create one project-owned provider voice per confidently identified speaker. */
export async function cloneJobSpeakers({ jobId, userId, projectId, segments, cleanDialoguePath = null } = {}) {
  if (!canCloneVoices()) throw new Error('ELEVENLABS_API_KEY is required for automatic voice cloning.');
  const job = db.prepare('SELECT id, media_id, params_json FROM dubbing_jobs WHERE id = ? AND user_id = ? AND project_id = ?')
    .get(jobId, userId, projectId);
  const project = db.prepare('SELECT id, source_media_id FROM projects WHERE id = ? AND user_id = ?')
    .get(projectId, userId);
  if (!job || !project || !job.media_id || job.media_id !== project.source_media_id) {
    throw new Error('Project source media is missing or does not belong to this dubbing job.');
  }
  const media = db.prepare('SELECT stored_filename FROM media_assets WHERE id = ? AND user_id = ?')
    .get(job.media_id, userId);
  const storageRoot = path.resolve(uploadsDir);
  const sourceFilePath = path.resolve(storageRoot, media?.stored_filename || '');
  if (!media || !sourceFilePath.startsWith(`${storageRoot}${path.sep}`) || !fs.existsSync(sourceFilePath)) {
    throw new Error('Source media is unavailable for voice cloning.');
  }
  verifyProjectDiarization({ userId, projectId, mediaId: job.media_id, segments,
    allowSpeakerCorrections: Boolean(cleanDialoguePath) && JSON.parse(job.params_json || '{}').qualityMode === 'cinema' });
  const plan = planSpeakerSamples(segments);
  if (plan.ready.length === 0 || plan.insufficient.length > 0) {
    const names = plan.insufficient.map((entry) => entry.speaker).join(', ');
    throw new Error(`Not enough clean speech to clone every speaker${names ? `: ${names}` : ''}.`);
  }

  const staleFailures = await cleanupJobVoiceClones(jobId);
  if (staleFailures.length > 0) throw new Error('Could not remove previous job voice clones before retrying.');

  const extracted = await extractSpeakerSamples({ sourceFilePath: cleanDialoguePath || sourceFilePath, segments });
  try {
    const voices = new Map();
    for (const sample of extracted.samples) {
      const clone = await createInstantVoiceClone({
        filePath: sample.filePath,
        name: `Dubla ${projectId} ${sample.speaker} ${randomUUID().slice(0, 6)}`.slice(0, 80),
      });
      try {
        db.prepare(`
          INSERT INTO job_voice_clones (
            id, job_id, user_id, project_id, speaker, provider_voice_id, consent_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(`clone-${randomUUID()}`, jobId, userId, projectId, sample.speaker,
          clone.providerVoiceId, ''); // Deprecated legacy column; no per-job consent assertion.
      } catch (error) {
        await deleteInstantVoiceClone(clone.providerVoiceId);
        throw error;
      }
      if (clone.requiresVerification) {
        throw new Error(`Voice verification is required for ${sample.speaker}; automatic cloning cannot continue.`);
      }
      voices.set(sample.speaker, clone.providerVoiceId);
    }
    return voices;
  } catch (error) {
    await cleanupJobVoiceClones(jobId);
    throw error;
  } finally {
    extracted.cleanup();
  }
}
