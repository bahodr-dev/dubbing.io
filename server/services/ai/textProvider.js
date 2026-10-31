/** Explicit routing prevents an unavailable provider from silently billing another. */
export function textProvider(env = process.env) {
  const provider = env.TRANSLATION_PROVIDER || (env.DEEPSEEK_API_KEY ? 'deepseek' : 'openai');
  if (!['openai', 'deepseek'].includes(provider)) throw new Error('Unsupported TRANSLATION_PROVIDER. Use deepseek or openai.');
  return provider === 'deepseek'
    ? { provider, apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL || 'deepseek-flash', url: 'https://api.deepseek.com/chat/completions' }
    : { provider, apiKey: env.OPENAI_API_KEY, model: env.OPENAI_TRANSLATION_MODEL || 'gpt-4o-mini', url: 'https://api.openai.com/v1/chat/completions' };
}
export function audioProvider(env = process.env) {
  return env.TRANSCRIPTION_PROVIDER || (textProvider(env).provider === 'deepseek' ? 'elevenlabs' : 'openai');
}
export function identityProvider(env = process.env) {
  const provider = env.FILM_IDENTITY_PROVIDER || (textProvider(env).provider === 'deepseek' ? 'manual' : 'gemini');
  if (!['manual', 'gemini'].includes(provider)) throw new Error('Unsupported FILM_IDENTITY_PROVIDER. Use manual or gemini.');
  return provider;
}
