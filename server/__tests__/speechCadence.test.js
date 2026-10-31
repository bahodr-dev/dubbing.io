import { describe, expect, it } from 'vitest';
import { cadenceTargetDuration, validateSpeechCadence } from '../services/speechCadence.js';

describe('speech cadence timing', () => {
  const segment = { startTime: 1, endTime: 3 };
  it('changes actual speech duration while preserving the speech start', () => {
    expect(cadenceTargetDuration(segment, [segment], 6, 'natural')).toBe(2);
    expect(cadenceTargetDuration(segment, [segment], 6, 'fast')).toBeCloseTo(2 / 1.15);
    expect(cadenceTargetDuration(segment, [segment], 6, 'narrative')).toBeCloseTo(2 / 0.9);
  });
  it('does not let narrative pacing extend into the next speaker or beyond the video', () => {
    expect(cadenceTargetDuration(segment, [segment, { startTime: 3, endTime: 4 }], 6, 'narrative')).toBe(2);
    expect(cadenceTargetDuration(segment, [segment], 3, 'narrative')).toBe(2);
  });
  it('rejects missing or unknown cadence values', () => {
    for (const value of [undefined, '', 'invalid', null]) expect(() => validateSpeechCadence(value)).toThrow(/Choose a Speech Cadence/);
  });
});
