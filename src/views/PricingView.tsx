import React, { useState } from 'react';
import { Check } from 'lucide-react';

interface PricingViewProps {
  onSelectPlan: (plan: string) => void;
}

export const PricingView: React.FC<PricingViewProps> = ({ onSelectPlan }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  return (
    <div style={{ backgroundColor: 'var(--c-white)', padding: '80px 0 100px' }}>
      <div className="container-lg">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <span className="mono" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--black-40)' }}>
            PRICING PLANS
          </span>
          <h1 style={{ fontSize: '48px', fontWeight: 800, letterSpacing: '-0.04em', marginTop: '8px', marginBottom: '16px' }}>
            Predictable, transparent pricing.
          </h1>
          <p style={{ fontSize: '18px', color: 'var(--black-60)', maxWidth: '520px', margin: '0 auto 32px' }}>
            Choose the plan that matches your production scale. Upgrade or cancel anytime.
          </p>

          {/* Billing Cycle Switcher */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'var(--black-05)',
            border: 'var(--border-light)',
            padding: '3px',
            borderRadius: 'var(--radius-xs)',
          }}>
            <button
              onClick={() => setBillingCycle('monthly')}
              style={{
                padding: '6px 16px',
                border: 'none',
                borderRadius: 'var(--radius-xs)',
                fontSize: '13px',
                fontWeight: 600,
                background: billingCycle === 'monthly' ? 'var(--black-100)' : 'transparent',
                color: billingCycle === 'monthly' ? 'var(--white-100)' : 'var(--black-70)',
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              Monthly billing
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              style={{
                padding: '6px 16px',
                border: 'none',
                borderRadius: 'var(--radius-xs)',
                fontSize: '13px',
                fontWeight: 600,
                background: billingCycle === 'yearly' ? 'var(--black-100)' : 'transparent',
                color: billingCycle === 'yearly' ? 'var(--white-100)' : 'var(--black-70)',
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              Yearly billing (Save 20%)
            </button>
          </div>
        </div>

        {/* 3 Tier Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '24px',
          marginBottom: '80px',
        }}>
          {/* 1. Free Tier */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700 }}>Free</h3>
                <p style={{ fontSize: '13px', color: 'var(--black-60)', marginTop: '4px' }}>
                  For trying dubbing.io with short clips
                </p>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.03em' }}>$0</span>
                <span style={{ fontSize: '13px', color: 'var(--black-40)' }}> / month</span>
              </div>

              <div style={{ borderTop: 'var(--border-light)', paddingTop: '20px', marginBottom: '24px' }}>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px', color: 'var(--black-80)' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={15} strokeWidth={2.5} /> 5 video minutes / month
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={15} strokeWidth={2.5} /> 5 core languages (incl. Uzbek)
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={15} strokeWidth={2.5} /> 720p HD video export
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={15} strokeWidth={2.5} /> Standard neural voices
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => onSelectPlan('free')}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', fontWeight: 600 }}
            >
              Get started
            </button>
          </div>

          {/* 2. Creator Tier (Solid Black Background - High-end Highlight) */}
          <div className="card-dark" style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            transform: 'scale(1.03)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
          }}>
            <div style={{
              position: 'absolute',
              top: '-12px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'var(--white-100)',
              color: 'var(--black-100)',
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '3px 12px',
              borderRadius: 'var(--radius-xs)',
            }}>
              Most Popular
            </div>

            <div>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--white-100)' }}>Creator</h3>
                <p style={{ fontSize: '13px', color: 'var(--white-70)', marginTop: '4px' }}>
                  For individual creators & storytellers
                </p>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--white-100)' }}>
                  {billingCycle === 'monthly' ? '$29' : '$23'}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--white-40)' }}> / month</span>
              </div>

              <div style={{ borderTop: 'var(--border-white-subtle)', paddingTop: '20px', marginBottom: '24px' }}>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px', color: 'var(--white-90)' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={15} strokeWidth={2.5} color="#ffffff" /> 60 video minutes / month
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={15} strokeWidth={2.5} color="#ffffff" /> 40+ supported languages
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={15} strokeWidth={2.5} color="#ffffff" /> 1080p Studio master export
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={15} strokeWidth={2.5} color="#ffffff" /> Full studio voice library
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={15} strokeWidth={2.5} color="#ffffff" /> Priority rendering queue
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={15} strokeWidth={2.5} color="#ffffff" /> SRT & WAV stem downloads
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => onSelectPlan('creator')}
              className="btn btn-white"
              style={{ width: '100%', padding: '12px', fontWeight: 700 }}
            >
              Start creating →
            </button>
          </div>

          {/* 3. Pro Tier */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: 700 }}>Pro</h3>
                <p style={{ fontSize: '13px', color: 'var(--black-60)', marginTop: '4px' }}>
                  For studios, agencies, and enterprises
                </p>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <span style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.03em' }}>
                  {billingCycle === 'monthly' ? '$89' : '$71'}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--black-40)' }}> / month</span>
              </div>

              <div style={{ borderTop: 'var(--border-light)', paddingTop: '20px', marginBottom: '24px' }}>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px', color: 'var(--black-80)' }}>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={15} strokeWidth={2.5} /> 300 video minutes / month
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={15} strokeWidth={2.5} /> 4K Ultra HD video rendering
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={15} strokeWidth={2.5} /> Instant 1-click voice cloning
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={15} strokeWidth={2.5} /> API access & automated webhooks
                  </li>
                  <li style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={15} strokeWidth={2.5} /> Dedicated account architect
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => onSelectPlan('pro')}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', fontWeight: 600 }}
            >
              Go Pro →
            </button>
          </div>
        </div>

        {/* Feature Comparison Matrix */}
        <div style={{ borderTop: 'var(--border-light)', paddingTop: '64px' }}>
          <h3 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '24px', textAlign: 'center' }}>
            Compare feature specifications
          </h3>

          <div style={{ border: 'var(--border-light)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--black-05)', borderBottom: 'var(--border-light)' }}>
                  <th style={{ padding: '14px 24px', fontWeight: 700 }}>Feature</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Free</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Creator</th>
                  <th style={{ padding: '14px 20px', fontWeight: 600 }}>Pro</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Monthly video minutes', free: '5 mins', creator: '60 mins', pro: '300 mins' },
                  { name: 'Languages supported', free: '5 languages', creator: '40+ languages', pro: '40+ languages' },
                  { name: 'Maximum video duration', free: '30 seconds', creator: '5 minutes', pro: '30 minutes' },
                  { name: 'Export Resolution', free: '720p HD', creator: '1080p Full HD', pro: '4K Ultra HD' },
                  { name: 'Lip-sync accuracy algorithm', free: 'Basic', creator: 'Neural v2', pro: 'Ultra-Precision v3' },
                  { name: 'SRT Subtitle Export', free: '✓', creator: '✓', pro: '✓' },
                  { name: 'Commercial Rights License', free: '—', creator: '✓', pro: '✓' },
                  { name: 'Custom Voice Cloning', free: '—', creator: '—', pro: '✓' },
                ].map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: idx < 7 ? 'var(--border-light)' : 'none',
                      backgroundColor: idx % 2 === 0 ? 'var(--c-white)' : 'var(--black-02)',
                    }}
                  >
                    <td style={{ padding: '12px 24px', fontWeight: 600, color: 'var(--black-100)' }}>{row.name}</td>
                    <td style={{ padding: '12px 20px', color: 'var(--black-70)' }}>{row.free}</td>
                    <td style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--black-100)' }}>{row.creator}</td>
                    <td style={{ padding: '12px 20px', fontWeight: 600, color: 'var(--black-100)' }}>{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
