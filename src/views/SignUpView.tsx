import React, { useState } from 'react';
import type { ActiveTab } from '../types';

interface SignUpViewProps {
  onNavigate?: (tab: ActiveTab) => void;
  onSuccess: (email: string) => void;
  onOpenSignIn?: () => void;
}

export const SignUpView: React.FC<SignUpViewProps> = ({
  onSuccess,
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }
    if (authMode !== 'forgot' && !password) {
      setError('Please enter your password.');
      return;
    }
    if (authMode !== 'forgot' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (authMode === 'forgot') {
      setResetSent(true);
      setError('');
      return;
    }

    setError('');
    onSuccess(email);
  };

  const handleGoogleAuth = () => {
    onSuccess('bahodir@dubbing.io');
  };

  const handleSSOAuth = () => {
    onSuccess('enterprise@dubbing.io');
  };

  return (
    <div className="signup-page-wrapper">
      {/* LEFT PANEL: Branding and Visual Identity (50%) */}
      <div className="signup-left-panel">
        {/* Brand Signature */}
        <div 
          onClick={() => {
            setEmail('');
            setPassword('');
            setError('');
            setAuthMode('signin');
          }}
          className="signup-anim-brand"
          style={{
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            userSelect: 'none',
            zIndex: 2,
          }}
        >
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: '#ffffff',
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
          }}>
            <div style={{ width: '2px', height: '9px', backgroundColor: '#000000', borderRadius: '0.5px' }}></div>
            <div style={{ width: '2px', height: '14px', backgroundColor: '#000000', borderRadius: '0.5px' }}></div>
            <div style={{ width: '2px', height: '6px', backgroundColor: '#000000', borderRadius: '0.5px' }}></div>
          </div>
          <span style={{
            fontSize: '15.5px',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: '#ffffff',
          }}>
            dubbing.io
          </span>
        </div>

        {/* Editorial Typography Composition */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 'clamp(32px, 6vh, 64px)',
          paddingLeft: 'clamp(0px, 8vw, 48px)',
          margin: 'auto 0',
          zIndex: 2,
        }}>
          {/* Block 1: ONE VIDEO. */}
          <div className="signup-anim-block1">
            <h1 className="signup-editorial-title">
              ONE<br />VIDEO.
            </h1>
          </div>

          {/* Block 2: EVERY LANGUAGE. */}
          <div className="signup-anim-block2">
            <h1 className="signup-editorial-title">
              EVERY<br />LANGUAGE.
            </h1>
          </div>
        </div>

        {/* Subtle Bottom Ambient Anchor */}
        <div style={{ zIndex: 2, opacity: 0.4 }}>
          <span className="mono" style={{ fontSize: '11px', letterSpacing: '0.06em', color: 'rgba(255, 255, 255, 0.7)' }}>
            STUDIO EDITION // v2.0
          </span>
        </div>
      </div>

      {/* RIGHT PANEL: Minimal Auth Form (50%) */}
      <div className="signup-right-panel">
        <div className="signup-anim-form" style={{ width: '100%', maxWidth: '380px' }}>
          
          {/* Header */}
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{
              fontSize: 'clamp(26px, 3vw, 32px)',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
              color: 'var(--black-100)',
              marginBottom: '8px',
            }}>
              {authMode === 'signin' && 'Sign in to Dubbing'}
              {authMode === 'signup' && 'Create your Dubbing account'}
              {authMode === 'forgot' && 'Reset your password'}
            </h2>
            <p style={{
              fontSize: '14px',
              color: 'rgba(0, 0, 0, 0.55)',
              lineHeight: 1.5,
              fontWeight: 400,
            }}>
              {authMode === 'signin' && 'Continue creating with your workspace.'}
              {authMode === 'signup' && 'Start dubbing in any language.'}
              {authMode === 'forgot' && 'Enter your email to receive a reset link.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                padding: '10px 14px',
                border: '1px solid #000000',
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                fontSize: '13px',
                marginBottom: '16px',
                borderRadius: '8px',
                color: '#000000',
              }}>
                {error}
              </div>
            )}

            {resetSent && (
              <div style={{
                padding: '10px 14px',
                border: '1px solid #16a34a',
                backgroundColor: 'rgba(22, 163, 74, 0.08)',
                fontSize: '13px',
                marginBottom: '16px',
                borderRadius: '8px',
                color: '#16a34a',
                fontWeight: 500,
              }}>
                Password reset link has been sent to your email!
              </div>
            )}

            {/* Email Field (Pill shape) */}
            <div style={{ marginBottom: '12px' }}>
              <input
                id="auth-email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus
                style={{
                  width: '100%',
                  height: '48px',
                  borderRadius: '9999px',
                  border: '1px solid rgba(0, 0, 0, 0.16)',
                  padding: '0 20px',
                  fontSize: '14px',
                  color: '#111827',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                  transition: 'border-color 140ms ease',
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#000000'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.16)'}
              />
            </div>

            {/* Password Field (Pill shape) */}
            {authMode !== 'forgot' && (
              <div style={{ marginBottom: '12px' }}>
                <input
                  id="auth-password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  style={{
                    width: '100%',
                    height: '48px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(0, 0, 0, 0.16)',
                    padding: '0 20px',
                    fontSize: '14px',
                    color: '#111827',
                    backgroundColor: '#ffffff',
                    outline: 'none',
                    transition: 'border-color 140ms ease',
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = '#000000'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.16)'}
                />
              </div>
            )}

            {/* Links Row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              margin: '10px 4px 20px 4px',
              fontSize: '13px',
            }}>
              {authMode === 'signin' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('signup');
                      setError('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(0, 0, 0, 0.65)',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    Create account
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot');
                      setError('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(0, 0, 0, 0.65)',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '13px',
                      fontWeight: 500,
                    }}
                  >
                    Forgot password?
                  </button>
                </>
              )}

              {authMode === 'signup' && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setError('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(0, 0, 0, 0.65)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  Already have an account? Sign in
                </button>
              )}

              {authMode === 'forgot' && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setError('');
                    setResetSent(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(0, 0, 0, 0.65)',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  ← Back to Sign in
                </button>
              )}
            </div>

            {/* Main Submit Button (Pill shape) */}
            <button
              type="submit"
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '9999px',
                backgroundColor: '#111827',
                color: '#ffffff',
                border: 'none',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 140ms ease',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#000000'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#111827'}
            >
              {authMode === 'signin' && 'Sign in'}
              {authMode === 'signup' && 'Create account'}
              {authMode === 'forgot' && 'Send reset link'}
            </button>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '22px 0',
            color: 'rgba(0, 0, 0, 0.35)',
          }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(0, 0, 0, 0.1)' }}></div>
            <span style={{ fontSize: '11px', fontWeight: 500, textTransform: 'lowercase' }}>
              or
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(0, 0, 0, 0.1)' }}></div>
          </div>

          {/* Social Auth Buttons Row (Google & SSO) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '24px' }}>
            {/* Google Icon Button */}
            <button
              type="button"
              onClick={handleGoogleAuth}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                border: '1px solid rgba(0, 0, 0, 0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'border-color 140ms ease, box-shadow 140ms ease',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.4)';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.14)';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
              }}
              title="Continue with Google"
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            </button>

            {/* Enterprise SSO / Key Button */}
            <button
              type="button"
              onClick={handleSSOAuth}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                border: '1px solid rgba(0, 0, 0, 0.14)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'border-color 140ms ease, box-shadow 140ms ease',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.4)';
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.08)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.14)';
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
              }}
              title="Enterprise Single Sign-On (SSO)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 11l-3 3-1-1" />
                <circle cx="19" cy="8" r="2" />
              </svg>
            </button>
          </div>

          {/* Legal Notice */}
          <p style={{
            fontSize: '11.5px',
            color: 'rgba(0, 0, 0, 0.45)',
            textAlign: 'center',
            lineHeight: 1.5,
          }}>
            By continuing, you agree to the{' '}
            <span style={{ color: 'rgba(0, 0, 0, 0.7)', cursor: 'pointer', textDecoration: 'underline' }}>Terms of Service</span>
            {' '}and{' '}
            <span style={{ color: 'rgba(0, 0, 0, 0.7)', cursor: 'pointer', textDecoration: 'underline' }}>Privacy Policy</span>.
          </p>

        </div>
      </div>
    </div>
  );
};
