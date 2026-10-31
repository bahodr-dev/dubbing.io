import fs from 'node:fs';
import path from 'node:path';
import { normalizeTranscript } from './transcriptNormalizer.js';
import { splitAudioIntoChunks } from './transcriptionChunker.js';

export function scribeSegments(words = [], offsetSeconds = 0, namespace = '') {
  const segments = [];
  const labels = new Map();
  let current = null;
  for (const word of words) {
    if (word.type !== 'word' || typeof word.text !== 'string' || !word.text.trim()) continue;
    if (!Number.isFinite(word.start) || !Number.isFinite(word.end) || word.start < 0 || word.end <= word.start) throw new Error('Scribe returned invalid word timestamps.');
    const id = typeof word.speaker_id === 'string' && word.speaker_id.trim() ? word.speaker_id : null;
    if (id && !labels.has(id)) labels.set(id, `${namespace}Speaker ${labels.size + 1}`);
    const speaker = id ? labels.get(id) : null;
    const start = offsetSeconds + word.start, end = offsetSeconds + word.end;
    if (!current || current.speaker !== speaker || start - current.end > 0.8 || end - current.start > 15 || /[.!?…]$/.test(current.text)) {
      current = { start, end, text: word.text.trim(), ...(speaker ? { speaker, speakerSource: 'diarization' } : {}), confidence: 0.7 };
      segments.push(current);
    } else {
      current.end = end;
      current.text = `${current.text} ${word.text.trim()}`.replace(/\s+([,;:.!?])/g, '$1');
    }
  }
  return segments;
}
export class ElevenLabsTranscriptionProvider {
  constructor({ apiKey = process.env.ELEVENLABS_API_KEY, model = process.env.ELEVENLABS_TRANSCRIPTION_MODEL || 'scribe_v2', fetchClient = globalThis.fetch } = {}) {
    this.apiKey = apiKey; this.model = model; this.fetch = fetchClient;
  }
  async single({ audioFilePath, language, duration, offsetSeconds = 0, namespace = '', signal }) {
    const bytes = fs.readFileSync(audioFilePath);
    if (bytes.length > 25 * 1024 * 1024) throw new Error('Scribe audio chunk exceeds the 25 MB application limit.');
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: path.extname(audioFilePath) === '.mp3' ? 'audio/mpeg' : 'audio/wav' }), path.basename(audioFilePath));
    form.append('model_id', this.model); form.append('diarize', 'true'); form.append('timestamps_granularity', 'word'); form.append('tag_audio_events', 'false');
    if (language && language !== 'auto') form.append('language_code', language);
    const timeout = AbortSignal.timeout(120000);
    const response = await this.fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST', headers: { 'xi-api-key': this.apiKey }, body: form,
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) throw new Error(`ElevenLabs transcription failed (${response.status}).`);
    const data = await response.json();
    const segments = scribeSegments(data.words, offsetSeconds, namespace);
    if (!segments.length && data.text?.trim()) throw new Error('Scribe returned speech without word timestamps; review is required.');
    return { segments, language: ({ eng: 'en', rus: 'ru', uzb: 'uz' })[data.language_code] || data.language_code || language, duration };
  }
  async transcribe({ audioFilePath, language = 'en', duration = 0, signal } = {}) {
    if (!this.apiKey) throw new Error('ELEVENLABS_API_KEY is required for Scribe transcription.');
    if (!audioFilePath || !fs.existsSync(audioFilePath)) throw new Error('Audio file does not exist on disk.');
    let chunks = [{ filePath: audioFilePath, duration, offsetSeconds: 0 }], cleanup = () => {};
    if (duration > 600 || fs.statSync(audioFilePath).size > 25 * 1024 * 1024) {
      ({ chunks, cleanup } = await splitAudioIntoChunks({ audioFilePath, totalDuration: duration, chunkDurationSeconds: 600 }));
    }
    try {
      const raw = []; let detectedLanguage = language;
      for (const [index, chunk] of chunks.entries()) {
        const result = await this.single({ audioFilePath: chunk.filePath, duration: chunk.duration, offsetSeconds: chunk.offsetSeconds, language,
          namespace: chunks.length > 1 ? `Chunk ${index + 1} ` : '', signal });
        raw.push(...result.segments); detectedLanguage = result.language;
      }
      // Silence is a valid scene; never invent dialogue to fill an empty response.
      if (!raw.length) return { segments: [], segmentCount: 0, duration, language: detectedLanguage };
      return normalizeTranscript(raw, { language: detectedLanguage, fallbackDuration: duration });
    } finally { cleanup(); }
  }
}
