import React, { useState, useEffect } from 'react';
import type { ActiveTab } from '../types';
import { Check, X, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface SignUpViewProps {
  onNavigate?: (tab: ActiveTab) => void;
  onSuccess: (email: string) => void;
  onOpenSignIn?: () => void;
}

export const SignUpView: React.FC<SignUpViewProps> = ({
  onSuccess,
}) => {
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check for error parameter from OAuth callbacks and listen for popup messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('error');
    if (err) {
      setError(decodeURIComponent(err));
    }

    const handleAuthMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data === 'object') {
        if (event.data.type === 'DUBBING_AUTH_SUCCESS') {
          if (event.data.token) {
            api.setToken(event.data.token);
          }
          if (event.data.user?.email) {
            onSuccess(event.data.user.email);
          }
        } else if (event.data.type === 'DUBBING_AUTH_ERROR') {
          setError(event.data.error || 'Authentication failed.');
        }
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'signup' && !name.trim()) {
      setError('Please enter your first name.');
      return;
    }
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
    setIsSubmitting(true);

    try {
      if (authMode === 'signup') {
        const res = await api.auth.signup(email, password, name.trim());
        onSuccess(res.user.email);
      } else {
        const res = await api.auth.signin(email, password);
        onSuccess(res.user.email);
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthStart = (provider: 'google' | 'github') => {
    setError('');
    const width = 540;
    const height = 650;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
    
    const popup = window.open(
      `/api/auth/${provider}`,
      `dubbing_oauth_${provider}`,
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      // Fallback if popup is blocked by browser
      window.location.assign(`/api/auth/${provider}`);
    }
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
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '11px 14px',
                backgroundColor: '#FEF2F2',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '10px',
                fontSize: '13px',
                lineHeight: 1.45,
                color: '#991B1B',
                marginBottom: '16px',
                animation: 'fadeIn 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 1px 3px rgba(239, 68, 68, 0.05)',
              }}>
                <AlertCircle size={16} color="#DC2626" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <span>{error}</span>
                  {error.toLowerCase().includes('sign up') && authMode === 'signin' && (
                    <span 
                      onClick={() => {
                        setAuthMode('signup');
                        setError('');
                      }}
                      style={{
                        display: 'block',
                        marginTop: '4px',
                        fontWeight: 600,
                        color: '#B91C1C',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                      }}
                    >
                      Create an account now →
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setError('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: 'rgba(153, 27, 27, 0.6)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px',
                  }}
                  title="Dismiss"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {resetSent && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '11px 14px',
                backgroundColor: '#111827',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                borderRadius: '10px',
                fontSize: '13px',
                color: '#ffffff',
                marginBottom: '16px',
                fontWeight: 500,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
              }}>
                <Check size={16} color="#ffffff" style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>If an account exists with this email, password reset instructions have been dispatched.</span>
              </div>
            )}

            {/* First Name Field (Pill shape) - Shown when creating an account */}
            {authMode === 'signup' && (
              <div style={{ marginBottom: '12px' }}>
                <input
                  id="auth-name"
                  type="text"
                  placeholder="First name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoComplete="given-name"
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
                autoFocus={authMode !== 'signup'}
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
              disabled={isSubmitting}
              style={{
                width: '100%',
                height: '48px',
                borderRadius: '9999px',
                backgroundColor: isSubmitting ? '#374151' : '#111827',
                color: '#ffffff',
                border: 'none',
                fontSize: '14px',
                fontWeight: 600,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                transition: 'background-color 140ms ease',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              onMouseEnter={e => !isSubmitting && (e.currentTarget.style.backgroundColor = '#000000')}
              onMouseLeave={e => !isSubmitting && (e.currentTarget.style.backgroundColor = '#111827')}
            >
              {isSubmitting ? 'Connecting...' : (
                <>
                  {authMode === 'signin' && 'Sign in'}
                  {authMode === 'signup' && 'Create account'}
                  {authMode === 'forgot' && 'Send reset link'}
                </>
              )}
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

          {/* Social Auth Buttons Row (Google & GitHub - Icon Only) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '24px' }}>
            {/* Google Icon Button */}
            <button
              type="button"
              onClick={() => handleOAuthStart('google')}
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#111827">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.053 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
              </svg>
            </button>

            {/* GitHub Icon Button */}
            <button
              type="button"
              onClick={() => handleOAuthStart('github')}
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
              title="Continue with GitHub"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#111827">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
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
