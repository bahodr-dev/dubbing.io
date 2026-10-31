import { db } from '../db.js';
import { getRenderableVoiceIds } from './ai/tts.js';

/** Assign a stable site voice to each detected speaker in the target language. */
export function availableSiteVoices(targetLanguage) {
  const availableIds = getRenderableVoiceIds();
  return db.prepare(`
    SELECT id FROM voices
    WHERE user_id IS NULL AND language_code = ?
    ORDER BY recommended DESC, name ASC
  `).all(targetLanguage).map((voice) => voice.id).filter((id) => availableIds.includes(id));
}

export function assignSiteVoices(segments, targetLanguage, primaryVoiceId) {
  const voices = availableSiteVoices(targetLanguage);
  if (voices.length === 0) {
    throw new Error(`No site voice is available for ${targetLanguage}. Choose another target language or voice cloning.`);
  }
  const orderedVoices = voices.includes(primaryVoiceId)
    ? [primaryVoiceId, ...voices.filter((id) => id !== primaryVoiceId)]
    : voices;
  const speakers = [...new Set(segments.map((segment) => segment.speaker).filter(Boolean))];
  if (speakers.length === 0) {
    throw new Error('No speakers were identified in the video. Retry with clearer speech.');
  }
  return Object.fromEntries(speakers.map((speaker, index) => [speaker, orderedVoices[index % orderedVoices.length]]));
}
