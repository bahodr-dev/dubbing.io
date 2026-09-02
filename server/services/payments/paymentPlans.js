/**
 * Dubbing.io Payment Plans & Pricing Matrix
 * Supports UZS (Uzbekistan So'm) and USD ($)
 */

export const PAYMENT_PLANS = {
  creator: {
    id: 'creator',
    name: 'Creator Plan',
    tier: 'creator',
    minutes: 60,
    priceMonthlyUSD: 29,
    priceMonthlyUZS: 375000,
    priceYearlyUSD: 23,
    priceYearlyUZS: 295000,
    description: 'For individual creators, vloggers & storytellers',
    features: [
      '60 video minutes / month',
      '40+ supported languages (including Uzbek)',
      '1080p Studio master export',
      'Full studio neural voice library',
      'Priority rendering queue',
      'SRT & WAV stems download',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro Studio Plan',
    tier: 'pro',
    minutes: 300,
    priceMonthlyUSD: 89,
    priceMonthlyUZS: 1150000,
    priceYearlyUSD: 71,
    priceYearlyUZS: 915000,
    description: 'For studios, agencies, media houses & enterprises',
    features: [
      '300 video minutes / month',
      '4K Ultra HD master rendering',
      'Instant 1-click voice cloning',
      'API access & automated webhooks',
      'Dedicated account architect',
      'Unlimited SRT/VTT/Stem exports',
    ],
  },
  pack_30: {
    id: 'pack_30',
    name: '+30 Extra Video Minutes',
    tier: 'addon',
    minutes: 30,
    priceMonthlyUSD: 15,
    priceMonthlyUZS: 195000,
    priceYearlyUSD: 15,
    priceYearlyUZS: 195000,
    description: 'Instant top-up of 30 video dubbing minutes with no expiration',
    features: [
      '+30 Minutes added to current balance',
      'Never expires',
      'Applicable on any active tier',
    ],
  },
  pack_100: {
    id: 'pack_100',
    name: '+100 Extra Video Minutes',
    tier: 'addon',
    minutes: 100,
    priceMonthlyUSD: 45,
    priceMonthlyUZS: 580000,
    priceYearlyUSD: 45,
    priceYearlyUZS: 580000,
    description: 'Instant top-up of 100 video dubbing minutes with no expiration',
    features: [
      '+100 Minutes added to current balance',
      'Never expires',
      'Applicable on any active tier',
    ],
  },
};

export function getPlan(planId) {
  return PAYMENT_PLANS[planId] || null;
}
