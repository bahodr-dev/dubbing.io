const PLACEHOLDER = /^(your_|change|development|test_|$)/i;

export function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const required = [
    'APP_URL', 'JWT_SECRET', 'OPENAI_API_KEY', 'ELEVENLABS_API_KEY',
    'PAYME_MERCHANT_ID', 'PAYME_SECRET_KEY', 'CLICK_SERVICE_ID',
    'CLICK_MERCHANT_ID', 'CLICK_SECRET_KEY', 'SENTRY_DSN', 'APP_RELEASE',
  ];
  const missing = required.filter((name) => !env[name] || PLACEHOLDER.test(env[name]));
  if (missing.length) throw new Error(`Production configuration is missing: ${missing.join(', ')}`);
  if (env.BETA_INVITE_REQUIRED !== 'true') throw new Error('BETA_INVITE_REQUIRED must be true in production beta.');
  if (env.PAYME_TEST_MODE === 'true' || env.CLICK_TEST_MODE === 'true') {
    throw new Error('Payment test mode must be disabled in production.');
  }
  if (!String(env.APP_URL).startsWith('https://')) throw new Error('APP_URL must use HTTPS in production.');
  if (String(env.JWT_SECRET).length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
  try {
    const sentryUrl = new URL(env.SENTRY_DSN);
    if (sentryUrl.protocol !== 'https:') throw new Error('not https');
  } catch (_) {
    throw new Error('SENTRY_DSN must be a valid HTTPS DSN.');
  }
}
