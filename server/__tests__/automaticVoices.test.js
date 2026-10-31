import { beforeAll, describe, expect, it, vi } from 'vitest';
import { assignSiteVoices } from '../services/automaticVoices.js';

import { initDatabase } from '../db.js';
beforeAll(() => { initDatabase(); vi.stubEnv('OPENAI_API_KEY', 'test'); });
describe('automatic site voice assignment', () => {
  it('assigns distinct available target-language voices to detected speakers', () => {
    const segments = [
      { speaker: 'Speaker 1' },
      { speaker: 'Speaker 2' },
      { speaker: 'Speaker 1' },
    ];
    const assigned = assignSiteVoices(segments, 'uz', 'voice-farrux');
    expect(assigned['Speaker 1']).toBe('voice-farrux');
    expect(assigned['Speaker 2']).not.toBe('voice-farrux');
    expect(Object.keys(assigned)).toHaveLength(2);
  });

  it('rejects media without detected speakers or target-language voices', () => {
    expect(() => assignSiteVoices([{ originalText: 'Hello' }], 'uz', 'voice-farrux'))
      .toThrow(/No speakers were identified/);
    expect(() => assignSiteVoices([{ speaker: 'Speaker 1' }], 'zz', 'voice-farrux'))
      .toThrow(/No site voice is available/);
  });
});
