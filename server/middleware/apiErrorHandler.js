import { randomUUID } from 'crypto';
import { logEvent } from '../services/logger.js';
import * as Sentry from '@sentry/node';

const STATUS_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  402: 'PAYMENT_REQUIRED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  416: 'RANGE_NOT_SATISFIABLE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL_ERROR',
};

function errorCodeFor(status) {
  return STATUS_CODES[status] || (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
}

/**
 * Keeps existing route handlers backwards compatible while standardising every
 * JSON API error response as { error, code, details, requestId }.
 */
export function normalizeApiErrors(req, res, next) {
  const originalJson = res.json.bind(res);
  res.locals.requestId = req.headers['x-request-id'] || randomUUID();

  res.json = (payload) => {
    if (
      res.statusCode >= 400 &&
      payload &&
      typeof payload === 'object' &&
      typeof payload.error === 'string'
    ) {
      return originalJson({
        ...payload,
        code: payload.code || errorCodeFor(res.statusCode),
        details: Array.isArray(payload.details) ? payload.details : [],
        requestId: res.locals.requestId,
      });
    }
    return originalJson(payload);
  };

  next();
}

export function apiNotFound(req, res) {
  return res.status(404).json({
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
}

export function apiErrorHandler(err, req, res, _next) {
  const status = Number.isInteger(err?.status) && err.status >= 400 && err.status < 600
    ? err.status
    : err?.code === 'LIMIT_FILE_SIZE'
      ? 413
      : 500;

  const isExpectedClientError = status >= 400 && status < 500;
  const message = isExpectedClientError && err?.message
    ? err.message
    : 'An unexpected server error occurred.';

  logEvent('api_request_failed', {
    requestId: res.locals.requestId || 'unknown',
    method: req.method,
    path: req.originalUrl,
    status,
    error: err?.message || 'Unknown error',
  });
  if (status >= 500 && Sentry.isInitialized()) {
    Sentry.withScope((scope) => {
      scope.setTag('request_id', res.locals.requestId || 'unknown');
      scope.setTag('http.method', req.method);
      scope.setTag('http.route', req.route?.path || req.path);
      if (req.params?.jobId) scope.setTag('job_id', req.params.jobId);
      Sentry.captureException(err);
    });
  }
  return res.status(status).json({
    error: message,
    code: typeof err?.code === 'string' && err.code !== 'LIMIT_FILE_SIZE' ? err.code : undefined,
  });
}
