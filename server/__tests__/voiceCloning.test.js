import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { app } from '../app.js';
import { db, uploadsDir } from '../db.js';
import * as transcriptionRepo from '../repositories/transcriptionRepository.js';
import * as mediaRepo from '../repositories/mediaRepository.js';
import { createInstantVoiceClone, deleteInstantVoiceClone, cloneJobSpeakers, verifyProjectDiarization } from '../services/ai/voiceCloning.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('ElevenLabs voice cloning', () => {
  it('sends a speaker sample to the cloning endpoint and returns the provider voice ID', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-clone-key');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dubla-clone-test-'));
    const samplePath = path.join(tempDir, 'speaker.wav');
    fs.writeFileSync(samplePath, 'RIFF....WAVEfmt ');
    const fetchClient = vi.fn(async (_url, _options) => ({
      ok: true,
      json: async () => ({ voice_id: 'provider-voice-123', requires_verification: false }),
    }));
    try {
      const clone = await createInstantVoiceClone({ filePath: samplePath, name: 'Speaker 1', fetchClient });
      expect(clone).toEqual({ providerVoiceId: 'provider-voice-123', requiresVerification: false });
      expect(fetchClient.mock.calls[0][0]).toBe('https://api.elevenlabs.io/v1/voices/add');
      const request = fetchClient.mock.calls[0][1];
      expect(request.headers['xi-api-key']).toBe('test-clone-key');
      expect(request.body.get('name')).toBe('Speaker 1');
      expect(request.body.get('files[]')).toBeInstanceOf(Blob);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('deletes a provider clone with the configured API key', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-clone-key');
    const fetchClient = vi.fn(async () => ({ ok: true, status: 200 }));
    await deleteInstantVoiceClone('provider-voice-123', { fetchClient });
    expect(fetchClient.mock.calls[0][0]).toBe('https://api.elevenlabs.io/v1/voices/provider-voice-123');
    expect(fetchClient.mock.calls[0][1].method).toBe('DELETE');
  });

  it('requires recorded consent before reading project media', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-clone-key');
    await expect(cloneJobSpeakers({
      jobId: 'unknown-job', userId: 'unknown-user', projectId: 'unknown-project',
      segments: [], consentAt: null,
    })).rejects.toThrow(/permission from every speaker/i);
  });

  it('rejects a job that does not belong to the stated owner and project', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-clone-key');
    await expect(cloneJobSpeakers({
      jobId: 'unknown-job', userId: 'unknown-user', projectId: 'unknown-project',
      segments: [], consentAt: new Date().toISOString(),
    })).rejects.toThrow(/does not belong to this dubbing job/i);
  });

  it('checks editable speaker labels against server-owned diarization evidence', async () => {
    const signup = await request(app).post('/api/auth/signup').send({
      email: `clone-evidence-${randomUUID()}@dubla.uz`,
      password: 'Password123!',
      name: 'Voice Owner',
    });
    expect(signup.status).toBe(201);
    const userId = signup.body.user.id;
    const cookie = signup.headers['set-cookie'].find((value) => value.includes('dubla_session='));
    const projectResponse = await request(app).post('/api/projects').set('Cookie', cookie).send({ title: 'Voice project' });
    expect(projectResponse.status).toBe(201);
    const projectId = projectResponse.body.project.id;
    const media = mediaRepo.createMediaAsset({
      userId, projectId, originalFilename: 'source.wav', storedFilename: `source-${randomUUID()}.wav`,
      storagePath: path.join(uploadsDir, `source-${randomUUID()}.wav`),
      mimeType: 'audio/wav', sizeBytes: 1024, mediaType: 'audio',
    });
    db.prepare('UPDATE projects SET source_media_id = ? WHERE id = ?').run(media.id, projectId);
    const job = transcriptionRepo.createTranscriptionJob({
      userId, projectId, mediaId: media.id, status: 'completed',
    });
    const segment = {
      id: `segment-${randomUUID()}`, startTime: 0, endTime: 12,
      originalText: 'Hello there', speaker: 'Speaker 1', speakerSource: 'diarization',
    };
    transcriptionRepo.saveTranscriptSegments(job.id, projectId, [segment]);

    expect(() => verifyProjectDiarization({
      userId, projectId, mediaId: media.id, segments: [segment],
    })).not.toThrow();
    expect(() => verifyProjectDiarization({
      userId, projectId, mediaId: media.id,
      segments: [{ ...segment, speaker: 'Speaker 2' }],
    })).toThrow(/speaker labels could not be verified/i);
  });
});
