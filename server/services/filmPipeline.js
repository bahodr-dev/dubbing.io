import { separationProvider } from './filmExperiment.js';
import { audioProvider, textProvider } from './ai/textProvider.js';
import { matchFilmCharacters } from './filmIdentity.js';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { db, uploadsDir } from '../db.js';
import { assertCinemaRevision, separateCinemaAudio, cinemaTranslation } from './cinema.js';
import { transcribeAudio } from './ai/transcription.js';
import { createInstantVoiceClone } from './ai/voiceCloning.js';
import { synthesizeSpeech } from './ai/tts.js';
import { runFfmpeg } from './media/dubbingRenderer.js';
import { getMediaDuration } from './media/durationDetector.js';
import { extractSpeakerSamples } from './media/speakerSampleExtractor.js';
import { createMediaAsset } from '../repositories/mediaRepository.js';
import { consumeMinutesForJob } from '../repositories/minuteUsageRepository.js';
import { filmRequest, characterForSpeaker, assertFilmFiles } from './filmStore.js';

const file = label => path.join(uploadsDir, `film-${label}-${randomUUID()}.wav`);
function asset(job, filePath, mimeType = 'audio/wav') {
  const media = createMediaAsset({ userId: job.userId, projectId: job.projectId,
    originalFilename: path.basename(filePath), storedFilename: path.basename(filePath), storagePath: filePath,
    mimeType, sizeBytes: fs.statSync(filePath).size, mediaType: mimeType.startsWith('video') ? 'video' : 'audio', status: 'ready' });
  return { mediaId: media.id, url: `/api/media/${media.id}` };
}
function saveChunk(job, chunk, stage, output, state = 'processing', error = null) {
  assertCinemaRevision(job);
  db.prepare('UPDATE film_chunks SET stage = ?, state = ?, output_json = ?, error = ? WHERE project_id = ? AND media_id = ? AND chunk_index = ?')
    .run(stage, state, JSON.stringify(output), typeof error === 'string' ? error.replaceAll(uploadsDir, '[media]') : error, job.projectId, job.mediaId, chunk.chunk_index);
}
function terms(job) {
  const episode = db.prepare('SELECT * FROM film_episodes WHERE project_id = ?').get(job.projectId);
  const series = episode?.series_id && db.prepare('SELECT glossary_json FROM film_series WHERE id = ?').get(episode.series_id);
  return { ...JSON.parse(series?.glossary_json || '{}'), ...JSON.parse(episode?.glossary_json || '{}'), ...job.params.glossary };
}
async function rememberSamples(job, chunk, stems, raw) {
  const extracted = await extractSpeakerSamples({ sourceFilePath: stems.dialogue.filePath, segments: raw, sampleOptions: { minSampleSeconds: 1, minClipSeconds: 0.35 } });
  try {
    for (const sample of extracted.samples) {
      const mapping = characterForSpeaker(job, chunk.chunk_index, sample.speaker, raw.some(s => s.speaker === sample.speaker && s.speakerSource === 'manual'));
      const existing = db.prepare('SELECT id FROM film_samples WHERE character_id = ? AND project_id = ? AND media_id = ? AND chunk_index = ?')
        .get(mapping.character_id, job.projectId, job.mediaId, chunk.chunk_index);
      if (existing) continue;
      const destination = file('sample');
      fs.copyFileSync(sample.filePath, destination);
      db.prepare('INSERT INTO film_samples(id, character_id, project_id, media_id, chunk_index, file_path, seconds) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(randomUUID(), mapping.character_id, job.projectId, job.mediaId, chunk.chunk_index, destination, sample.durationSeconds);
    }
  } finally { extracted.cleanup(); }
}
async function characterVoice(job, characterId) {
  const character = db.prepare('SELECT * FROM film_characters WHERE id = ? AND user_id = ?').get(characterId, job.userId);
  if (!character) return null;
  if (character.clone_state === 'ready' && character.provider_voice_id) return character.provider_voice_id;
  const samples = db.prepare(`SELECT s.* FROM film_samples s JOIN film_characters c ON c.id = s.character_id
    WHERE c.id = ? AND c.user_id = ? ORDER BY s.seconds DESC LIMIT 3`).all(characterId, job.userId);
  if (samples.reduce((sum, s) => sum + s.seconds, 0) < 10) return null;
  assertFilmFiles(samples.map(s => s.file_path));
  const sampleFile = file('clone-input');
  try {
    await concatWav(samples.map(s => s.file_path), sampleFile);
    const clone = await filmRequest(job, 'clone', { characterId, samples: samples.map(s => s.id) },
      () => createInstantVoiceClone({ filePath: sampleFile, name: `Dubla ${character.name}`.slice(0, 80) }));
    db.prepare('UPDATE film_characters SET provider_voice_id = ?, clone_state = ? WHERE id = ? AND user_id = ?')
      .run(clone.providerVoiceId, clone.requiresVerification ? 'verification_required' : 'ready', characterId, job.userId);
    return clone.requiresVerification ? null : clone.providerVoiceId;
  } finally { if (fs.existsSync(sampleFile)) fs.unlinkSync(sampleFile); }
}
async function concatWav(paths, output) {
  assertFilmFiles(paths);
  const list = path.join(uploadsDir, `film-concat-${randomUUID()}.txt`);
  // Generated artifact names only; reject control characters rather than
  // allowing source filenames to enter FFmpeg's concat language.
  if (paths.some(p => /[\r\n']/.test(p))) throw new Error('Unsafe artifact path.');
  fs.writeFileSync(list, paths.map(p => `file '${p}'`).join('\n'));
  try { await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', list, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', output]); }
  finally { fs.unlinkSync(list); }
}
async function renderChunk(duration, segments, output) {
  // Render in bounded batches then merge on disk. Each file spans at most one
  // minute, avoiding a full-film padded file for every dialogue batch.
  const passes = [];
  try {
    for (let offset = 0; offset < Math.max(segments.length, 1); offset += 20) {
      const batch = segments.slice(offset, offset + 20);
      const pass = file('pass'); passes.push(pass);
      if (!batch.length) {
        await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', String(duration), '-c:a', 'pcm_s16le', pass]);
        continue;
      }
      const filters = batch.map((s, i) => `[${i}:a]aresample=48000,atempo=${Math.max(0.7, s.duration / (s.endTime - s.startTime)).toFixed(5)},atrim=0:${s.endTime - s.startTime},adelay=${Math.round(s.startTime * 1000)}:all=1,apad,atrim=0:${duration}[s${i}]`);
      filters.push(`${batch.map((_, i) => `[s${i}]`).join('')}amix=inputs=${batch.length}:normalize=0,alimiter=limit=0.95[out]`);
      await runFfmpeg(['-y', ...batch.flatMap(s => ['-i', s.filePath]), '-filter_complex', filters.join(';'), '-map', '[out]', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', pass]);
    }
    // Incremental merge bounds the number of open files even for very dense speech.
    await runFfmpeg(['-y', '-i', passes[0], '-c:a', 'pcm_s16le', output]);
    for (const next of passes.slice(1)) {
      const merged = file('merge');
      try {
        await runFfmpeg(['-y', '-i', output, '-i', next, '-filter_complex', '[0:a][1:a]amix=inputs=2:normalize=0,alimiter=limit=0.95[out]', '-map', '[out]', '-c:a', 'pcm_s16le', merged]);
        fs.renameSync(merged, output);
      } finally { if (fs.existsSync(merged)) fs.unlinkSync(merged); }
    }
  } finally { for (const p of passes) if (fs.existsSync(p)) fs.unlinkSync(p); }
}
const stamp = (seconds, decimal = ',') => {
  const ms = Math.max(0, Math.round(seconds * 1000));
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}${decimal}${String(ms % 1000).padStart(3, '0')}`;
};
export function filmSubtitles(segments, vtt = false) {
  return (vtt ? 'WEBVTT\n\n' : '') + segments.map((s, i) => `${i + 1}\n${stamp(s.startTime, vtt ? '.' : ',')} --> ${stamp(s.endTime, vtt ? '.' : ',')}\n${s.unresolvedReason ? `[UNRESOLVED: ${s.unresolvedReason}] ` : ''}${(s.translatedText || s.originalText || '').replace(/[\r\n]+/g, ' ')}\n`).join('\n');
}
async function transcribeFilmChunk(job, stems, duration, language) {
  try {
    const segments = await transcribeAudio({ filePath: stems.dialogue.filePath, duration, language, providerType: audioProvider(), jobId: job.id });
    if (segments.length > 500 || segments.reduce((sum, s) => sum + (s.originalText || s.text || '').length, 0) > 10000) throw new Error('Transcription exceeds the bounded scene dialogue limit.');
    return segments;
  } catch (error) {
    if (/Transcript is empty|No valid spoken dialogue/i.test(error.message)) return [];
    throw error;
  }
}
export async function runFilmPipeline(job, params, persist) {
  assertCinemaRevision(job);
  for (let start = 0, index = 0; start < params.duration; start += 60, index++) {
    db.prepare('INSERT OR IGNORE INTO film_chunks(project_id, media_id, chunk_index, start_time, end_time) VALUES (?, ?, ?, ?, ?)')
      .run(job.projectId, job.mediaId, index, start, Math.min(start + 60, params.duration));
  }
  const chunks = db.prepare('SELECT * FROM film_chunks WHERE project_id = ? AND media_id = ? ORDER BY chunk_index').all(job.projectId, job.mediaId);
  const outputs = [];
  // First gather all scene samples. A quiet character can then use clean speech
  // from a later scene or a previously confirmed episode.
  for (const chunk of chunks) {
    job.status = 'transcribing'; job.progress = Math.round(5 + 35 * chunk.chunk_index / chunks.length);
    job.currentStage = `Preparing scene ${chunk.chunk_index + 1}/${chunks.length}`; persist();
    const output = JSON.parse(chunk.output_json || '{}');
    const duration = chunk.end_time - chunk.start_time;
    if (output.stems && (output.separationMode || 'fal') !== separationProvider()) {
      delete output.stems; delete output.dialogue; delete output.audioSignature; delete output.raw;
    }
    try {
      if (!output.stems) {
        const source = file('source');
        try {
          await runFfmpeg(['-y', '-ss', String(chunk.start_time), '-i', params.filePath, '-t', String(duration), '-vn', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', source]);
          if (separationProvider() === 'none') {
            const dialogue = file('unseparated-source'), background = file('silent-background');
            fs.copyFileSync(source, dialogue);
            await runFfmpeg(['-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', String(duration), '-c:a', 'pcm_s16le', background]);
            output.stems = { dialogue: { filePath: dialogue, ...asset(job, dialogue) }, background: { filePath: background, ...asset(job, background) } };
          } else {
            output.stems = await filmRequest(job, 'separation', { mediaId: job.mediaId, chunk: chunk.chunk_index },
              () => separateCinemaAudio({ ...job, mediaId: `${job.mediaId}:chunk:${chunk.chunk_index}` }, source, duration));
          }
          output.separationMode = separationProvider();
        } finally { if (fs.existsSync(source)) fs.unlinkSync(source); }
        saveChunk(job, chunk, 'separated', output);
      }
      if (output.sourceLanguage && output.sourceLanguage !== params.originalLanguage) throw new Error('Source language changed. Create a new film project to re-transcribe safely.');
      assertFilmFiles([output.stems.dialogue.filePath, output.stems.background.filePath]);
      if (!output.raw) {
        output.raw = audioProvider() === 'transcript'
          ? params.savedSegments.filter(s => s.startTime >= chunk.start_time && s.startTime < chunk.end_time).map(s => ({ ...s, startTime: s.startTime - chunk.start_time, endTime: s.endTime - chunk.start_time }))
          : await filmRequest(job, 'transcription', { mediaId: job.mediaId, chunk: chunk.chunk_index, language: params.originalLanguage, provider: audioProvider(), model: audioProvider() === 'elevenlabs' ? (process.env.ELEVENLABS_TRANSCRIPTION_MODEL || 'scribe_v2') : (process.env.TRANSCRIPTION_MODEL || 'gpt-4o-transcribe-diarize') },
            () => transcribeFilmChunk(job, output.stems, duration, params.originalLanguage));
        output.raw = output.raw.map((s, i) => ({ ...s, id: audioProvider() === 'transcript' ? s.id : `film-${chunk.chunk_index}-${i}`, originalText: s.originalText || s.text || '',
          startTime: Math.max(0, s.startTime), endTime: Math.min(duration, s.endTime) })).filter(s => s.endTime > s.startTime);
        output.sourceLanguage = params.originalLanguage;
        saveChunk(job, chunk, 'transcribed', output);
      }
      for (const speaker of new Set(output.raw.map(s => s.speaker || 'Unknown'))) characterForSpeaker(job, chunk.chunk_index, speaker, output.raw.some(s => s.speaker === speaker && s.speakerSource === 'manual'));
      await rememberSamples(job, chunk, output.stems, output.raw);
      try { await matchFilmCharacters(job, chunk.chunk_index); }
      catch (error) {
        if (error.code === 'FILM_BUDGET_REACHED' || error.code === 'LEASE_LOST') throw error;
        // Matching failure cannot substitute another voice. Separate profiles
        // remain visible for review while the remaining movie proceeds.
        output.identityWarning = 'character_match_review';
      }
      outputs.push(output);
    } catch (error) {
      saveChunk(job, chunk, error.code || 'preparation_failed', output, 'blocked', error.message);
      throw error;
    }
  }
  const allSegments = [];
  const current = assertCinemaRevision(job);
  const edits = new Map(JSON.parse(current.segments_json || '[]').map(s => [s.id, s]));
  const glossary = terms(job);
  for (const [index, chunk] of chunks.entries()) {
    const output = outputs[index];
    try {
      job.status = 'synthesizing'; job.progress = Math.round(40 + 45 * index / chunks.length);
      job.currentStage = `Dubbing scene ${index + 1}/${chunks.length}`; persist();
      // Preserve user text and character corrections; original timings remain
      // owned by the chunk transcription, never supplied by an editable client.
      let segments = output.raw.map(s => {
        const edit = edits.get(s.id) || output.segments?.find(previous => previous.id === s.id);
        return edit ? { ...s, originalText: typeof edit.originalText === 'string' ? edit.originalText : s.originalText, translatedText: edit.translatedText, translationEdited: edit.translationEdited,
          translationLanguage: edit.translationLanguage, translationSourceText: edit.translationSourceText } : s;
      });
      for (let start = 0; start < segments.length; start += 25) {
        const batch = segments.slice(start, start + 25);
        const translated = batch.every(s => s.translatedText?.trim() && (s.translationEdited || (s.translationLanguage === 'uz' && s.translationSourceText === s.originalText)));
        if (translated) continue;
        const context = { previous: segments[start - 1]?.originalText || outputs[index - 1]?.raw.at(-1)?.originalText,
          next: segments[start + 25]?.originalText || outputs[index + 1]?.raw[0]?.originalText };
        const translatedInput = { mediaId: job.mediaId, chunk: index, batch, glossary, context, provider: textProvider().provider, model: textProvider().model };
        const result = await filmRequest(job, 'translation', translatedInput,
          () => cinemaTranslation(job, batch, params.originalLanguage, 'uz', glossary, null, context));
        segments.splice(start, batch.length, ...result);
      }
      const audio = [];
      for (let i = 0; i < segments.length; i++) {
        let segment = segments[i];
        const mapping = characterForSpeaker(job, index, segment.speaker || 'Unknown', segment.speakerSource === 'manual');
        segment = { ...segment, characterId: mapping.character_id, qualityWarnings: [] };
        if (!mapping.confirmed) segment.qualityWarnings.push('character_match_review');
        if (segments.some(other => other.id !== segment.id && other.startTime < segment.endTime && other.endTime > segment.startTime)) segment.qualityWarnings.push('overlapping_speech');
        if (segment.startTime < 0.05 || segment.endTime >= chunk.end_time - chunk.start_time - 0.05) segment.qualityWarnings.push('chunk_boundary_review');
        if ((segment.translatedText || '').length > 2000) segment.unresolvedReason = 'translation_text_limit';
        if (separationProvider() === 'none') segment.qualityWarnings.push('background_omitted', 'unseparated_clone_sample');
        if (!['diarization', 'manual'].includes(segment.speakerSource) && !mapping.confirmed) segment.unresolvedReason = 'speaker_identification_required';
        let voice;
        try { if (!segment.unresolvedReason) voice = await characterVoice(job, mapping.character_id); }
        catch (error) {
          if (error.code === 'FILM_BUDGET_REACHED' || error.code === 'LEASE_LOST') throw error;
          segment.unresolvedReason = error.code || 'clone_failed';
        }
        if (!voice) segment.unresolvedReason ||= 'insufficient_clean_voice_sample';
        if (!segment.unresolvedReason) {
          for (let attempt = 0; attempt < 3; attempt++) {
            let speech;
            try {
              speech = await filmRequest(job, 'speech', { mediaId: job.mediaId, id: segment.id, text: segment.translatedText, voice }, async () => {
                const result = await synthesizeSpeech({ text: segment.translatedText, elevenLabsVoiceId: voice, qualityMode: 'cinema', expression: 'neutral', languageCode: 'uz', registerAsset: false });
                return { filePath: result.filePath, duration: await getMediaDuration(result.filePath) };
              });
            } catch (error) {
              if (error.code === 'FILM_BUDGET_REACHED' || error.code === 'LEASE_LOST') throw error;
              segment.unresolvedReason = error.code || 'speech_failed'; break;
            }
            assertFilmFiles([speech.filePath]);
            if (speech.duration <= (segment.endTime - segment.startTime) * 1.45) {
              audio.push({ ...speech, startTime: segment.startTime, endTime: segment.endTime }); break;
            }
            if (attempt === 2 || segment.translationEdited) { segment.unresolvedReason = 'translation_too_long'; break; }
            const retry = { attempt: attempt + 1, seconds: segment.endTime - segment.startTime, measuredSeconds: speech.duration,
              previous: segments[i - 1]?.originalText || outputs[index - 1]?.raw.at(-1)?.originalText,
              next: segments[i + 1]?.originalText || outputs[index + 1]?.raw[0]?.originalText };
            [segment] = await filmRequest(job, 'translation', { segment, glossary, retry, provider: textProvider().provider, model: textProvider().model },
              () => cinemaTranslation(job, [segment], params.originalLanguage, 'uz', glossary, retry));
          }
        }
        segments[i] = { ...segment, regenerationStatus: segment.unresolvedReason ? 'needs_edit' : 'ready' };
      }
      const signature = JSON.stringify(audio);
      if (!output.dialogue || output.audioSignature !== signature || !fs.existsSync(output.dialogue)) {
        output.dialogue = file('dialogue');
        await renderChunk(chunk.end_time - chunk.start_time, audio, output.dialogue);
        output.audioSignature = signature;
      }
      output.segments = segments.map(s => ({ ...s, startTime: s.startTime + chunk.start_time, endTime: s.endTime + chunk.start_time }));
      saveChunk(job, chunk, 'ready', output, segments.some(s => s.unresolvedReason) ? 'partial' : 'complete');
      allSegments.push(...output.segments);
    } catch (error) {
      saveChunk(job, chunk, error.code || 'synthesis_failed', output, 'blocked', error.message);
      throw error;
    }
  }
  job.status = 'rendering'; job.progress = 90; job.currentStage = 'Rendering film review copy and stems'; persist();
  const dialogue = file('dialogue-master'), background = file('background-master'), mix = file('mix');
  const video = path.join(uploadsDir, `film-review-${randomUUID()}.mp4`);
  try {
  await concatWav(outputs.map(o => o.dialogue), dialogue);
  await concatWav(outputs.map(o => o.stems.background.filePath), background);
  await runFfmpeg(['-y', '-i', background, '-i', dialogue, '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[out]', '-map', '[out]', '-c:a', 'pcm_s16le', mix]);
  const source = db.prepare('SELECT media_type FROM media_assets WHERE id = ?').get(job.mediaId);
  if (source?.media_type !== 'audio') await runFfmpeg(['-y', '-i', params.filePath, '-i', mix, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-t', String(params.duration), '-movflags', '+faststart', video]);
  const unresolved = allSegments.filter(s => s.unresolvedReason);
  const status = unresolved.length ? 'partial' : 'completed';
  db.transaction(() => {
    assertCinemaRevision(job);
    const dialogueAsset = asset(job, dialogue), backgroundAsset = asset(job, background), mixed = asset(job, mix);
    const videoAsset = source?.media_type !== 'audio' ? asset(job, video, 'video/mp4') : null;
    job.status = status; job.progress = 100; job.currentStage = unresolved.length ? 'Partial review copy: unresolved dialogue is silent; background preserved.' : 'Film review copy ready.';
    job.result = { qualityMode: 'cinema', filmMode: true, separationMode: separationProvider(), backgroundPreserved: separationProvider() === 'fal', transcript: allSegments, segmentCount: allSegments.length,
      audioUrl: mixed.url, audioMediaId: mixed.mediaId, videoUrl: videoAsset?.url || '', videoMediaId: videoAsset?.mediaId || null,
      dialogueUrl: dialogueAsset.url, backgroundUrl: backgroundAsset.url, unresolved,
      exports: { srt: `/api/films/projects/${job.projectId}/export/srt`, vtt: `/api/films/projects/${job.projectId}/export/vtt`, report: `/api/films/projects/${job.projectId}/export/report` } };
    persist();
    db.prepare('UPDATE projects SET status = ?, segments_json = ?, output_media_id = ?, output_audio_media_id = ?, cinema_stems_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(status, JSON.stringify(allSegments), videoAsset?.mediaId || null, mixed.mediaId, JSON.stringify({ dialogueUrl: dialogueAsset.url, backgroundUrl: backgroundAsset.url }), job.projectId);
    consumeMinutesForJob(job.id);
  }).immediate();
  } catch (error) {
    for (const p of [dialogue, background, mix, video]) if (fs.existsSync(p)) fs.unlinkSync(p);
    throw error;
  }
}
