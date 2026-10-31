export const SPEECH_CADENCES = ['natural', 'fast', 'narrative'];

export function validateSpeechCadence(value) {
  if (!SPEECH_CADENCES.includes(value)) {
    const error = new Error('Choose a Speech Cadence before starting dubbing.');
    error.status = 400;
    error.code = 'SPEECH_CADENCE_REQUIRED';
    throw error;
  }
  return value;
}

/** Keep speech starts anchored to the source; use free space for slower delivery. */
export function cadenceTargetDuration(segment, segments, sourceDuration, cadence) {
  validateSpeechCadence(cadence);
  const window = Math.max(0.1, segment.endTime - segment.startTime);
  if (cadence === 'fast') return window / 1.15;
  if (cadence === 'natural') return window;
  const nextStart = segments.reduce((next, candidate) =>
    candidate.startTime > segment.startTime ? Math.min(next, candidate.startTime) : next, sourceDuration);
  const available = Math.max(window, nextStart - segment.startTime - 0.08);
  return Math.min(window / 0.9, available, Math.max(0.1, sourceDuration - segment.startTime));
}
