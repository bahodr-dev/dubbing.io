import { validateTranscript } from '../validators/projectValidator.js';
export function separationProvider(env = process.env) {
  const mode = env.FILM_SEPARATION_PROVIDER || 'fal';
  if (!['fal', 'none'].includes(mode)) throw new Error('FILM_SEPARATION_PROVIDER must be fal or none.');
  return mode;
}
export function importSourceTranscript(text, format = 'srt') {
  if (typeof text !== 'string' || text.length > 1_000_000) throw new Error('Import at most 1 MB of source subtitles.');
  let segments;
  if (format === 'json') {
    const parsed = JSON.parse(text);
    segments = Array.isArray(parsed) ? parsed : parsed.transcript;
  } else if (format === 'srt') {
    const seconds = value => { const [h, m, s, ms] = value.split(/[:,.]/).map(Number); return h * 3600 + m * 60 + s + ms / 1000; };
    segments = text.replace(/^\uFEFF/, '').replace(/\r/g, '').trim().split(/\n\s*\n/).map((block, index) => {
      const lines = block.split('\n');
      const timing = lines.findIndex(line => line.includes('-->'));
      const match = /^(\d{2,}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2,}:\d{2}:\d{2}[,.]\d{3})\s*$/.exec(lines[timing] || '');
      if (!match) throw new Error(`Invalid SRT timing in block ${index + 1}.`);
      const content = lines.slice(timing + 1).join(' ').replace(/<[^>]*>/g, '').trim();
      const labelled = /^\[([^\]]{1,80})\]\s*(.+)$/.exec(content);
      return { id: `subtitle-${index}`, startTime: seconds(match[1]), endTime: seconds(match[2]), originalText: labelled ? labelled[2] : content,
        speaker: labelled ? labelled[1].trim() : 'Unknown' };
    });
  } else throw new Error('Use srt or json subtitles.');
  if (!Array.isArray(segments) || !segments.length || !validateTranscript(segments).valid) throw new Error('Import valid timed transcript segments.');
  if (segments.some(s => typeof (s.originalText || s.text) !== 'string' || !(s.originalText || s.text).trim())) throw new Error('Every subtitle must contain source text.');
  return segments.map((s, i) => ({ id: s.id || `subtitle-${i}`, startTime: s.startTime, endTime: s.endTime, originalText: s.originalText || s.text || '',
    translatedText: '', translationEdited: false, speaker: s.speaker?.trim() || 'Unknown',
    speakerSource: s.speaker?.trim() && s.speaker !== 'Unknown' ? 'manual' : 'manual-unverified' }));
}
