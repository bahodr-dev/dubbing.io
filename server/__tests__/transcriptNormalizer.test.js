import { describe, it, expect } from 'vitest';
import { normalizeTranscript } from '../services/transcription/transcriptNormalizer.js';

describe('Transcript Normalizer Unit Tests', () => {
  it('1. Normalizes, trims whitespace, and sorts segments chronologically', () => {
    const rawSegments = [
      { start: 4.5, end: 7.2, text: '   Second   sentence here.   ' },
      { start: 1.0, end: 3.8, text: 'First spoken phrase.' },
    ];

    const result = normalizeTranscript(rawSegments, { language: 'en' });

    expect(result.segmentCount).toBe(2);
    expect(result.segments[0].text).toBe('First spoken phrase.');
    expect(result.segments[0].start).toBe(1.0);
    expect(result.segments[0].end).toBe(3.8);

    expect(result.segments[1].text).toBe('Second sentence here.');
    expect(result.segments[1].start).toBe(4.5);
    expect(result.segments[1].end).toBe(7.2);
  });

  it('2. Corrects invalid or inverted timestamps (start >= end)', () => {
    const rawSegments = [
      { start: 5.0, end: 3.0, text: 'Inverted timestamps test' },
    ];

    const result = normalizeTranscript(rawSegments);
    expect(result.segments[0].start).toBe(5.0);
    expect(result.segments[0].end).toBeGreaterThan(5.0);
  });

  it('3. Filters out empty or whitespace-only dialogue segments', () => {
    const rawSegments = [
      { start: 1.0, end: 2.0, text: '   ' },
      { start: 2.0, end: 3.0, text: '\n\t' },
      { start: 3.0, end: 5.0, text: 'Valid speech segment' },
    ];

    const result = normalizeTranscript(rawSegments);
    expect(result.segmentCount).toBe(1);
    expect(result.segments[0].text).toBe('Valid speech segment');
  });

  it('4. Generates unique IDs and provides backward-compatible property aliases', () => {
    const rawSegments = [
      { start: 0.5, end: 2.5, text: 'Hello world' },
    ];

    const result = normalizeTranscript(rawSegments);
    const seg = result.segments[0];

    expect(seg.id).toBeDefined();
    expect(seg.id).toMatch(/^seg-/);
    expect(seg.startTime).toBe(0.5);
    expect(seg.endTime).toBe(2.5);
    expect(seg.originalText).toBe('Hello world');
    expect(seg.translatedText).toBe('Hello world');
  });

  it('5. Throws error when transcript contains no valid segments', () => {
    expect(() => {
      normalizeTranscript([]);
    }).toThrow(/empty/i);

    expect(() => {
      normalizeTranscript([{ start: 1.0, end: 2.0, text: '   ' }]);
    }).toThrow(/empty/i);
  });

  it('6. Rejects non-array input', () => {
    expect(() => {
      normalizeTranscript(null);
    }).toThrow(/must be an array/i);
  });
});
