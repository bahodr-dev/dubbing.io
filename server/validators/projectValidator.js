const PROJECT_STATUSES = new Set(['draft', 'processing', 'completed', 'failed', 'ready', 'paused', 'partial']);
const MAX_TITLE_LENGTH = 160;
const MAX_DESCRIPTION_LENGTH = 2_000;
const MAX_SEGMENTS = 10_000;
const MAX_SEGMENT_TEXT_LENGTH = 10_000;
const MAX_DURATION_SECONDS = 24 * 60 * 60;
const MAX_PAGE_SIZE = 100;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function addStringError(errors, value, field, { required = false, maxLength }) {
  if (value === undefined) return;
  if (typeof value !== 'string') {
    errors.push(`${field} must be a string.`);
    return;
  }

  const trimmed = value.trim();
  if (required && !trimmed) errors.push(`${field} cannot be empty.`);
  if (maxLength && trimmed.length > maxLength) {
    errors.push(`${field} must be at most ${maxLength} characters.`);
  }
}

function validateDuration(errors, duration) {
  if (duration === undefined) return;
  if (typeof duration !== 'number' || !Number.isFinite(duration)) {
    errors.push('duration must be a finite number.');
  } else if (duration < 0 || duration > MAX_DURATION_SECONDS) {
    errors.push(`duration must be between 0 and ${MAX_DURATION_SECONDS} seconds.`);
  }
}

export function validateTranscript(transcript) {
  const errors = [];
  const segmentIds = new Set();
  if (!Array.isArray(transcript)) {
    return { valid: false, errors: ['transcript must be an array of segments.'] };
  }
  if (transcript.length > MAX_SEGMENTS) {
    errors.push(`transcript cannot contain more than ${MAX_SEGMENTS} segments.`);
  }

  transcript.forEach((segment, index) => {
    const field = `transcript[${index}]`;
    if (!isPlainObject(segment)) {
      errors.push(`${field} must be an object.`);
      return;
    }

    addStringError(errors, segment.id, `${field}.id`, { required: true, maxLength: 160 });
    if (typeof segment.id === 'string' && segment.id.trim()) {
      if (segmentIds.has(segment.id)) {
        errors.push(`${field}.id must be unique within the transcript.`);
      }
      segmentIds.add(segment.id);
    }
    addStringError(errors, segment.originalText, `${field}.originalText`, { maxLength: MAX_SEGMENT_TEXT_LENGTH });
    addStringError(errors, segment.translatedText, `${field}.translatedText`, { maxLength: MAX_SEGMENT_TEXT_LENGTH });
    if (segment.translationEdited !== undefined && typeof segment.translationEdited !== 'boolean') {
      errors.push(`${field}.translationEdited must be a boolean.`);
    }
    if (segment.expression !== undefined && !['neutral', 'whisper', 'shout', 'sad', 'happy'].includes(segment.expression)) errors.push(`${field}.expression is invalid.`);
    if (segment.expressionEdited !== undefined && typeof segment.expressionEdited !== 'boolean') errors.push(`${field}.expressionEdited must be a boolean.`);
    addStringError(errors, segment.speaker, `${field}.speaker`, { maxLength: 160 });

    if (typeof segment.startTime !== 'number' || !Number.isFinite(segment.startTime) || segment.startTime < 0 || segment.startTime > MAX_DURATION_SECONDS) {
      errors.push(`${field}.startTime must be a finite number between 0 and ${MAX_DURATION_SECONDS}.`);
    }
    if (typeof segment.endTime !== 'number' || !Number.isFinite(segment.endTime) || segment.endTime < 0 || segment.endTime > MAX_DURATION_SECONDS) {
      errors.push(`${field}.endTime must be a finite number between 0 and ${MAX_DURATION_SECONDS}.`);
    }
    if (
      typeof segment.startTime === 'number' && Number.isFinite(segment.startTime) &&
      typeof segment.endTime === 'number' && Number.isFinite(segment.endTime) &&
      segment.endTime <= segment.startTime
    ) {
      errors.push(`${field}.endTime must be greater than startTime.`);
    }
    if (segment.confidence !== undefined && (
      typeof segment.confidence !== 'number' || !Number.isFinite(segment.confidence) ||
      segment.confidence < 0 || segment.confidence > 1
    )) {
      errors.push(`${field}.confidence must be a number between 0 and 1.`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/** Validates data accepted by POST /api/projects and PUT /api/projects/:id. */
export function validateProjectPayload(payload) {
  const errors = [];
  if (!isPlainObject(payload)) {
    return { valid: false, errors: ['Request body must be a JSON object.'] };
  }

  if (payload.title !== undefined) {
    addStringError(errors, payload.title, 'title', { required: true, maxLength: MAX_TITLE_LENGTH });
  }
  addStringError(errors, payload.description, 'description', { maxLength: MAX_DESCRIPTION_LENGTH });
  addStringError(errors, payload.voiceId, 'voiceId', { maxLength: 160 });
  addStringError(errors, payload.originalLanguage, 'originalLanguage', { maxLength: 32 });
  addStringError(errors, payload.targetLanguage, 'targetLanguage', { maxLength: 32 });
  addStringError(errors, payload.mediaId, 'mediaId', { maxLength: 160 });

  if (payload.speakerVoices !== undefined) {
    if (!isPlainObject(payload.speakerVoices)) {
      errors.push('speakerVoices must be a speaker-to-voice map.');
    } else {
      const entries = Object.entries(payload.speakerVoices);
      if (entries.length > 50) errors.push('speakerVoices cannot contain more than 50 speakers.');
      for (const [speaker, voiceId] of entries) {
        if (!speaker.trim() || speaker.length > 160 || typeof voiceId !== 'string' || !voiceId.trim() || voiceId.length > 160) {
          errors.push('speakerVoices keys and values must be non-empty strings of at most 160 characters.');
          break;
        }
      }
    }
  }

  if (payload.id !== undefined && (typeof payload.id !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(payload.id))) {
    errors.push('id may only contain letters, numbers, underscores, and hyphens.');
  }
  if (payload.status !== undefined && !PROJECT_STATUSES.has(payload.status)) {
    errors.push(`status must be one of: ${[...PROJECT_STATUSES].join(', ')}.`);
  }
  validateDuration(errors, payload.duration);

  const transcript = payload.transcript ?? payload.segments;
  if (transcript !== undefined) {
    const result = validateTranscript(transcript);
    errors.push(...result.errors);
  }

  return { valid: errors.length === 0, errors };
}

export function sendProjectValidationError(res, errors) {
  return res.status(400).json({
    error: 'Invalid project data.',
    details: errors,
  });
}

/** Parses and validates the optional query parameters accepted by GET /api/projects. */
export function parseProjectListQuery(query) {
  const errors = [];
  const rawPage = query.page ?? '1';
  const rawLimit = query.limit ?? '24';
  const page = Number(rawPage);
  const limit = Number(rawLimit);
  const search = query.search ?? '';
  const status = query.status ?? 'all';

  if (!Number.isInteger(page) || page < 1 || page > 1_000_000) {
    errors.push('page must be a positive integer.');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    errors.push(`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`);
  }
  if (typeof search !== 'string' || search.trim().length > 100) {
    errors.push('search must be a string of at most 100 characters.');
  }
  if (typeof status !== 'string' || (status !== 'all' && !PROJECT_STATUSES.has(status))) {
    errors.push(`status must be "all" or one of: ${[...PROJECT_STATUSES].join(', ')}.`);
  }

  if (errors.length > 0) return { valid: false, errors };
  return {
    valid: true,
    value: {
      page,
      limit,
      search: search.trim(),
      status,
    },
  };
}
