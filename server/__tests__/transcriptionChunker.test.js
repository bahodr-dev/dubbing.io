import { describe, it, expect } from 'vitest';
import { splitAudioIntoChunks } from '../services/transcription/transcriptionChunker.js';

describe('Audio Chunker Service', () => {
  it('throws an error when input audio file is missing', async () => {
    await expect(splitAudioIntoChunks({ audioFilePath: '/tmp/non-existent-chunk-audio.mp3' }))
      .rejects.toThrow(/does not exist/i);
  });
});
