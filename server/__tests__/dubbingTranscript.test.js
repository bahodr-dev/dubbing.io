import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { JobManager, resolveSegmentVoiceId } from '../services/jobQueue.js';
import { translateSegments } from '../services/ai/translation.js';
import { synthesizeSpeech } from '../services/ai/tts.js';
import * as dubbingJobRepo from '../repositories/dubbingJobRepository.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Saved transcript in dubbing jobs', () => {
  it('snapshots the project transcript when the job is created', async () => {
    const signup = await request(app).post('/api/auth/signup').send({
      email: `dub-transcript-${Date.now()}@dubla.uz`,
      password: 'Password123!',
      name: 'Transcript Editor',
    });
    expect(signup.status).toBe(201);
    const cookie = signup.headers['set-cookie'].find((value) => value.includes('dubla_session='));
    const capabilities = await request(app).get('/api/dubbing/capabilities').set('Cookie', cookie);
    expect(capabilities.status).toBe(200);
    expect(capabilities.body.renderableVoiceIds).toContain('voice-dilnoza');
    expect(capabilities.body.renderableVoiceIds).not.toContain('voice-chloe');
    const originalSegments = [{
      id: 'segment-1', startTime: 0, endTime: 2,
      originalText: 'Edited source', translatedText: 'Edited translation', speaker: 'Speaker 1',
    }, {
      id: 'segment-2', startTime: 2, endTime: 3,
      originalText: 'Second voice', translatedText: 'Ikkinchi ovoz', speaker: 'Speaker 2',
    }];
    const project = await request(app).post('/api/projects').set('Cookie', cookie).send({
      title: 'Transcript snapshot', transcript: originalSegments,
      speakerVoices: { 'Speaker 1': 'voice-dilnoza' },
    });
    expect(project.status).toBe(201);

    vi.spyOn(JobManager, 'dispatchPersistedJob').mockReturnValue(true);
    const job = JobManager.createJob({
      userId: signup.body.user.id,
      projectId: project.body.project.id,
      duration: 3,
    });
    const stored = dubbingJobRepo.findDubbingJobById(job.id);
    const params = dubbingJobRepo.getDubbingJobParams(stored);
    expect(params.savedSegments).toEqual(originalSegments);
    expect(params.speakerVoices).toEqual({ 'Speaker 1': 'voice-dilnoza' });
    expect(resolveSegmentVoiceId(originalSegments[0], params)).toBe('voice-dilnoza');
    expect(resolveSegmentVoiceId(originalSegments[1], params)).toBe('voice-farrux');
    expect(resolveSegmentVoiceId({ speaker: 'constructor' }, params)).toBe('voice-farrux');

    const changed = await request(app)
      .put(`/api/projects/${project.body.project.id}/transcript`)
      .set('Cookie', cookie)
      .send({ transcript: [{ ...originalSegments[0], translatedText: 'Later edit' }] });
    expect(changed.status).toBe(200);
    expect(dubbingJobRepo.getDubbingJobParams(dubbingJobRepo.findDubbingJobById(job.id)).savedSegments)
      .toEqual(originalSegments);
    const changedVoices = await request(app)
      .put(`/api/projects/${project.body.project.id}`)
      .set('Cookie', cookie)
      .send({ speakerVoices: { 'Speaker 1': 'voice-jasur' } });
    expect(changedVoices.status).toBe(200);
    expect(dubbingJobRepo.getDubbingJobParams(dubbingJobRepo.findDubbingJobById(job.id)).speakerVoices)
      .toEqual({ 'Speaker 1': 'voice-dilnoza' });
  });

  it('keeps edited source and translation while filling untranslated segments', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.stubEnv('DEEPL_API_KEY', '');
    const result = await translateSegments({
      segments: [
        { id: 'edited', text: 'Stale source', originalText: 'Edited source', translatedText: 'Edited dub' },
        { id: 'new', originalText: 'Needs translation' },
        { id: 'raw', originalText: 'Welcome everyone to our next generation AI studio presentation.', translatedText: 'Welcome everyone to our next generation AI studio presentation.' },
        { id: 'same', originalText: 'Brand', translatedText: 'Brand', translationEdited: true },
        { id: 'source-edit', text: 'Stale source', originalText: 'New source', translatedText: 'Old translation', translationEdited: false },
      ],
      sourceLanguage: 'en',
      targetLanguage: 'uz',
      preserveExistingTranslations: true,
    });
    expect(result[0]).toMatchObject({ originalText: 'Edited source', translatedText: 'Edited dub' });
    expect(result[1]).toMatchObject({ originalText: 'Needs translation', translatedText: 'Needs translation' });
    expect(result[2].translatedText).toBe("Barchangizni yangi avlod sun'iy intellekt studiyamiz taqdimotiga xush kelibsiz.");
    expect(result[3].translatedText).toBe('Brand');
    expect(result[4].translatedText).toBe('New source');
  });

  it('rejects a voice with no speech provider mapping', async () => {
    await expect(synthesizeSpeech({ text: 'Hello', voiceId: 'voice-chloe' }))
      .rejects.toThrow(/not connected to a speech provider/i);
  });

  it('requires explicit speaker permission before scheduling automatic cloning', () => {
    expect(() => JobManager.createJob({
      userId: 'user-1', projectId: 'project-1', duration: 30,
      autoCloneVoices: true, voiceCloningConsent: false,
    })).toThrow(/permission from every speaker/i);
  });

  it('does not fall back to a preset voice when cloned speech synthesis fails', async () => {
    vi.stubEnv('ELEVENLABS_API_KEY', 'test-clone-key');
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false, status: 503 });

    await expect(synthesizeSpeech({ text: 'Salom', elevenLabsVoiceId: 'provider-voice-123' }))
      .rejects.toThrow(/cloned voice synthesis failed/i);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('translates segments in a single batch request when OpenAI is configured', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              translations: [
                { index: 0, translatedText: 'Salom dunyo' },
                { index: 1, translatedText: 'Biz yangi tizim quryapmiz' },
              ],
            }),
          },
        }],
      }),
    });

    const segments = [
      { id: '1', originalText: 'Hello world', speaker: 'Speaker 1' },
      { id: '2', originalText: 'We are building a new system', speaker: 'Speaker 2' },
    ];

    const result = await translateSegments({
      segments,
      sourceLanguage: 'en',
      targetLanguage: 'uz',
    });

    expect(result[0].translatedText).toBe('Salom dunyo');
    expect(result[1].translatedText).toBe('Biz yangi tizim quryapmiz');
    // Exactly 1 fetch request should be made for both segments instead of 2!
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
