import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Sparkles, ExternalLink, Loader2, Zap } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlanId?: string;
  onSuccess?: () => void;
}

interface PlanDetails {
  id: string;
  name: string;
  tier: string;
  minutes: number;
  priceMonthlyUSD: number;
  priceMonthlyUZS: number;
  priceYearlyUSD: number;
  priceYearlyUZS: number;
  description: string;
  features: string[];
}

const DEFAULT_PLANS: Record<string, PlanDetails> = {
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
    features: ['+30 Minutes added to current balance', 'Never expires', 'Applicable on any active tier'],
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
    features: ['+100 Minutes added to current balance', 'Never expires', 'Applicable on any active tier'],
  },
};

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  selectedPlanId = 'creator',
  onSuccess,
}) => {
  const { showSuccess, showError } = useToast();

  const [planId, setPlanId] = useState<string>(selectedPlanId || 'creator');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [provider, setProvider] = useState<'payme' | 'click' | 'uzum'>('payme');
  const [isLoading, setIsLoading] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);

  useEffect(() => {
    if (selectedPlanId) {
      setPlanId(selectedPlanId);
    }
  }, [selectedPlanId]);

  if (!isOpen) return null;

  const plan = DEFAULT_PLANS[planId] || DEFAULT_PLANS.creator;
  const isYearly = billingCycle === 'yearly' && plan.tier !== 'addon';

  const displayPriceUSD = isYearly ? plan.priceYearlyUSD : plan.priceMonthlyUSD;
  const displayPriceUZS = isYearly ? plan.priceYearlyUZS : plan.priceMonthlyUZS;
  const totalAmountUZS = isYearly ? plan.priceYearlyUZS * 12 : plan.priceMonthlyUZS;

  const handleCreateOrder = async () => {
    setIsLoading(true);
    try {
      const res = await api.payments.createCheckout({
        planId: plan.id,
        billingCycle,
        provider,
        returnUrl: `${window.location.origin}/dashboard?payment=success`,
      });

      setActiveOrder(res.order);

      // Open provider checkout in new tab
      const targetUrl = provider === 'click' ? res.paymentUrls.click : res.paymentUrls.payme;
      window.open(targetUrl, '_blank');
      showSuccess(`Redirecting to ${provider.toUpperCase()} checkout gateway...`);
    } catch (err: unknown) {
      const errorObj = err as Error;
      showError(errorObj.message || 'Failed to initiate payment.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulatePayment = async () => {
    setIsSimulating(true);
    try {
      // 1. Create order if not created yet
      let currentOrderId = activeOrder?.id;
      if (!currentOrderId) {
        const orderRes = await api.payments.createCheckout({
          planId: plan.id,
          billingCycle,
          provider,
        });
        currentOrderId = orderRes.order.id;
        setActiveOrder(orderRes.order);
      }

      // 2. Simulate success
      const res = await api.payments.simulateSuccess(currentOrderId);
      showSuccess(res.message || '🎉 Subscription successfully activated!');
      onSuccess?.();
      onClose();
    } catch (err: unknown) {
      const errorObj = err as Error;
      showError(errorObj.message || 'Simulation error.');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 160ms ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          animation: 'modalSlideUp 200ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '22px 24px 18px',
            borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FAFAFA',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'rgba(0, 0, 0, 0.5)',
              }}
            >
              SECURE CHECKOUT
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', marginTop: '2px' }}>
              Upgrade to {plan.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              cursor: 'pointer',
              color: 'rgba(0, 0, 0, 0.5)',
              borderRadius: '8px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '24px' }}>
          {/* Plan Selector & Billing Cycle Toggle */}
          {plan.tier !== 'addon' && (
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                  padding: '4px',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: 'none',
                    borderRadius: '7px',
                    fontSize: '13px',
                    fontWeight: 600,
                    background: billingCycle === 'monthly' ? '#000000' : 'transparent',
                    color: billingCycle === 'monthly' ? '#FFFFFF' : 'rgba(0, 0, 0, 0.65)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  Monthly billing
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: 'none',
                    borderRadius: '7px',
                    fontSize: '13px',
                    fontWeight: 600,
                    background: billingCycle === 'yearly' ? '#000000' : 'transparent',
                    color: billingCycle === 'yearly' ? '#FFFFFF' : 'rgba(0, 0, 0, 0.65)',
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                  }}
                >
                  Yearly billing <span style={{ fontSize: '11px', opacity: 0.85 }}>(-20%)</span>
                </button>
              </div>
            </div>
          )}

          {/* Pricing & Value Summary Card */}
          <div
            style={{
              backgroundColor: '#050505',
              color: '#FFFFFF',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.03em' }}>
                  {displayPriceUZS.toLocaleString('uz-UZ')} UZS
                </span>
                <span style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', marginLeft: '6px' }}>
                  / {isYearly ? 'month (billed yearly)' : 'month'}
                </span>
              </div>
              <div
                style={{
                  fontSize: '12.5px',
                  fontWeight: 600,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                }}
              >
                ${displayPriceUSD} USD
              </div>
            </div>

            {isYearly && (
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '4px' }}>
                Annual total: {totalAmountUZS.toLocaleString('uz-UZ')} UZS ({plan.minutes * 12} mins total)
              </div>
            )}

            <div
              style={{
                marginTop: '16px',
                paddingTop: '14px',
                borderTop: '1px solid rgba(255, 255, 255, 0.12)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.9)',
              }}
            >
              <Sparkles size={15} color="#FFFFFF" />
              <span>Includes {plan.minutes} AI video dubbing minutes {isYearly ? '/ month' : ''}</span>
            </div>
          </div>

          {/* Payment Provider Selection */}
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'rgba(0, 0, 0, 0.6)',
                marginBottom: '10px',
              }}
            >
              Select Payment Method
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {/* Payme */}
              <div
                onClick={() => setProvider('payme')}
                style={{
                  border: provider === 'payme' ? '2px solid #000000' : '1px solid rgba(0, 0, 0, 0.12)',
                  borderRadius: '10px',
                  padding: '12px 10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: provider === 'payme' ? 'rgba(0, 0, 0, 0.03)' : '#FFFFFF',
                  transition: 'all 120ms ease',
                }}
              >
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#00C7B1', letterSpacing: '-0.02em' }}>
                  payme
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.6)', marginTop: '2px', fontWeight: 600 }}>
                  Uzcard / Humo
                </div>
              </div>

              {/* Click */}
              <div
                onClick={() => setProvider('click')}
                style={{
                  border: provider === 'click' ? '2px solid #000000' : '1px solid rgba(0, 0, 0, 0.12)',
                  borderRadius: '10px',
                  padding: '12px 10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: provider === 'click' ? 'rgba(0, 0, 0, 0.03)' : '#FFFFFF',
                  transition: 'all 120ms ease',
                }}
              >
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0073FF', letterSpacing: '-0.02em' }}>
                  CLICK
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.6)', marginTop: '2px', fontWeight: 600 }}>
                  Click Up / QR
                </div>
              </div>

              {/* Uzum / Card */}
              <div
                onClick={() => setProvider('uzum')}
                style={{
                  border: provider === 'uzum' ? '2px solid #000000' : '1px solid rgba(0, 0, 0, 0.12)',
                  borderRadius: '10px',
                  padding: '12px 10px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: provider === 'uzum' ? 'rgba(0, 0, 0, 0.03)' : '#FFFFFF',
                  transition: 'all 120ms ease',
                }}
              >
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#7000FF', letterSpacing: '-0.02em' }}>
                  Uzum Pay
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(0, 0, 0, 0.6)', marginTop: '2px', fontWeight: 600 }}>
                  Visa / Master / Humo
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={handleCreateOrder}
              disabled={isLoading}
              className="btn btn-primary"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '14px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Connecting to {provider.toUpperCase()}...</span>
                </>
              ) : (
                <>
                  <span>Pay with {provider === 'click' ? 'Click' : (provider === 'payme' ? 'Payme' : 'Uzum Pay')}</span>
                  <ExternalLink size={15} />
                </>
              )}
            </button>

            {/* Test Mode / Fast Sandbox Simulation button */}
            <button
              type="button"
              onClick={handleSimulatePayment}
              disabled={isSimulating}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '12.5px',
                fontWeight: 600,
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                border: '1px dashed rgba(0, 0, 0, 0.2)',
                borderRadius: '8px',
                color: 'rgba(0, 0, 0, 0.8)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 120ms ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.09)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)')}
            >
              {isSimulating ? (
                <>
                  <Loader2 size={14} className="spin" />
                  <span>Activating subscription...</span>
                </>
              ) : (
                <>
                  <Zap size={14} color="#000000" />
                  <span>⚡ Test Instant Activation (Sandbox Demo Mode)</span>
                </>
              )}
            </button>
          </div>

          {/* Security Guarantee Footer */}
          <div
            style={{
              marginTop: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '11.5px',
              color: 'rgba(0, 0, 0, 0.5)',
            }}
          >
            <ShieldCheck size={14} color="rgba(0, 0, 0, 0.6)" />
            <span>256-bit SSL encrypted • Instant delivery • Cancel anytime</span>
          </div>
        </div>
      </div>
    </div>
  );
};
