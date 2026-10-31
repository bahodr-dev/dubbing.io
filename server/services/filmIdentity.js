import { identityProvider } from './ai/textProvider.js';
import fs from 'node:fs';
import { db } from '../db.js';
import { filmRequest } from './filmStore.js';

// Compare bounded, isolated voice samples. Speaker labels themselves are never
// evidence: providers restart those labels independently in every scene.
export async function matchFilmCharacters(job, chunkIndex) {
  if (identityProvider() === 'manual') return;
  const mappings = db.prepare(`SELECT m.*, c.series_id FROM film_speakers m JOIN film_characters c ON c.id=m.character_id
    WHERE m.project_id=? AND m.media_id=? AND m.chunk_index=? AND m.confirmed=0 AND m.match_source IS NULL`).all(job.projectId, job.mediaId, chunkIndex);
  for (const mapping of mappings) {
    const sample = db.prepare('SELECT * FROM film_samples WHERE character_id=? AND project_id=? AND media_id=? AND chunk_index=? ORDER BY seconds DESC LIMIT 1').get(mapping.character_id, job.projectId, job.mediaId, chunkIndex);
    if (!sample || !fs.existsSync(sample.file_path)) continue;
    const candidates = db.prepare(`SELECT c.id, c.name, s.file_path, MAX(s.seconds) AS seconds FROM film_characters c
      JOIN film_samples s ON s.character_id=c.id
      WHERE c.user_id=? AND c.id != ? AND ((? IS NOT NULL AND c.series_id=?) OR (? IS NULL AND c.project_id=?))
        AND (s.project_id != ? OR s.chunk_index < ?)
      GROUP BY c.id ORDER BY seconds DESC LIMIT 32`).all(job.userId, mapping.character_id, mapping.series_id, mapping.series_id,
        mapping.series_id, job.projectId, job.projectId, chunkIndex).filter(c => fs.existsSync(c.file_path));
    let best = null;
    for (let start = 0; start < candidates.length; start += 8) {
      const batch = candidates.slice(start, start + 8);
      const result = await filmRequest(job, 'identity', { characterId: mapping.character_id, sampleId: sample.id, candidates: batch.map(c => c.id) }, async () => {
        const parts = [
          { text: 'Identify whether the QUERY voice is the same person as one of the reference voices, across languages, delivery and noise. Never match based on text, names or speaker labels. Be conservative. Return JSON {"characterId":string|null,"confidence":number}. Choose only a supplied reference ID. Low certainty means null. QUERY:' },
          { inline_data: { mime_type: 'audio/wav', data: fs.readFileSync(sample.file_path).toString('base64') } },
        ];
        for (const candidate of batch) parts.push({ text: `REFERENCE ID: ${candidate.id}` },
          { inline_data: { mime_type: 'audio/wav', data: fs.readFileSync(candidate.file_path).toString('base64') } });
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
          method: 'POST', headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(120000), body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: 'application/json' } }),
        });
        if (!response.ok) throw new Error(`Character matching failed (${response.status}).`);
        const data = await response.json();
        const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '{}');
        return batch.some(c => c.id === parsed.characterId) && Number.isFinite(parsed.confidence) && parsed.confidence >= 0 && parsed.confidence <= 1 ? parsed : { characterId: null, confidence: 0 };
      });
      if (result.characterId && (!best || result.confidence > best.confidence)) best = result;
    }
    if (!best || best.confidence < 0.9) {
      db.prepare('UPDATE film_speakers SET confidence=?, match_source=? WHERE project_id=? AND media_id=? AND chunk_index=? AND speaker=?').run(best?.confidence || 0, 'audio_comparison_review', job.projectId, job.mediaId, chunkIndex, mapping.speaker);
      continue;
    }
    db.transaction(() => {
      db.prepare('UPDATE film_speakers SET character_id=?, confidence=?, match_source=? WHERE project_id=? AND media_id=? AND chunk_index=? AND speaker=? AND confirmed=0')
        .run(best.characterId, best.confidence, 'audio_comparison', job.projectId, job.mediaId, chunkIndex, mapping.speaker);
      db.prepare('UPDATE OR IGNORE film_samples SET character_id=? WHERE id=?').run(best.characterId, sample.id);
    }).immediate();
  }
}
