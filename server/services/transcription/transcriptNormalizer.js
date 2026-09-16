import { randomUUID } from 'crypto';

/**
 * Validates, cleans, orders, and formats transcript segments into a uniform structure
 *
 * @param {Array<Object>} rawSegments
 * @param {Object} [options]
 * @param {string} [options.language='en']
 * @param {number} [options.fallbackDuration=0]
 * @returns {{ segments: Array<Object>, segmentCount: number, duration: number, language: string }}
 */
export function normalizeTranscript(rawSegments = [], {
  language = 'en',
  fallbackDuration = 0,
} = {}) {
  if (!Array.isArray(rawSegments)) {
    throw new Error('Transcript input must be an array of segments.');
  }

  const validSegments = [];

  for (let i = 0; i < rawSegments.length; i++) {
    const raw = rawSegments[i];
    if (!raw || typeof raw !== 'object') continue;

    const rawText = typeof raw.text === 'string' ? raw.text : (typeof raw.originalText === 'string' ? raw.originalText : '');
    const cleanText = rawText.replace(/\s+/g, ' ').trim();

    if (!cleanText) {
      continue; // Strip empty text segments
    }

    let start = typeof raw.start === 'number' ? raw.start : (typeof raw.startTime === 'number' ? raw.startTime : 0);
    let end = typeof raw.end === 'number' ? raw.end : (typeof raw.endTime === 'number' ? raw.endTime : start + 3);

    if (isNaN(start) || !isFinite(start) || start < 0) {
      start = 0;
    }
    if (isNaN(end) || !isFinite(end) || end <= start) {
      end = start + 2.0; // Ensure positive duration if end timestamp is invalid
    }

    start = parseFloat(Number(start).toFixed(2));
    end = parseFloat(Number(end).toFixed(2));

    const id = raw.id || `seg-${randomUUID().slice(0, 8)}`;
    const speaker = raw.speaker || `Speaker ${(i % 2) + 1}`;
    const confidence = typeof raw.confidence === 'number' ? parseFloat(Number(raw.confidence).toFixed(3)) : 0.96;

    validSegments.push({
      id,
      start,
      end,
      text: cleanText,
      // Compatibility aliases for frontend and export systems
      startTime: start,
      endTime: end,
      originalText: cleanText,
      translatedText: typeof raw.translatedText === 'string' ? raw.translatedText : cleanText,
      speaker,
      confidence,
    });
  }

  // Sort strictly in chronological order
  validSegments.sort((a, b) => a.start - b.start);

  if (validSegments.length === 0) {
    throw new Error('Transcript is empty. No valid spoken dialogue segments detected.');
  }

  const maxEnd = validSegments.reduce((max, s) => Math.max(max, s.end), 0);
  const totalDuration = parseFloat(Math.max(maxEnd, fallbackDuration).toFixed(2));

  return {
    segments: validSegments,
    segmentCount: validSegments.length,
    duration: totalDuration,
    language,
  };
}
