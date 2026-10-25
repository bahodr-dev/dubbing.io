import * as Sentry from '@sentry/node';

function scrubEvent(event) {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }
  }
  if (event.extra) {
    for (const key of ['transcript', 'segments', 'mediaUrl', 'media_url', 'filePath', 'storagePath']) delete event.extra[key];
  }
  return event;
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_RELEASE || undefined,
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.05),
    beforeSend: scrubEvent,
  });
}
