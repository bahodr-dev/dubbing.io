const placeholder = /^(your_|change|dubbing_|test_|$)/i;

export function isPaymentProviderConfigured(provider) {
  if (process.env.NODE_ENV === 'test') return true;
  const fields = provider === 'payme'
    ? ['PAYME_MERCHANT_ID', 'PAYME_SECRET_KEY']
    : provider === 'click'
      ? ['CLICK_SERVICE_ID', 'CLICK_MERCHANT_ID', 'CLICK_SECRET_KEY']
      : [];
  return fields.length > 0 && fields.every((name) => {
    const value = process.env[name]?.trim();
    return value && !placeholder.test(value);
  });
}
