import React, { useState } from 'react';
import type { ActiveTab } from '../types';
import { Check, X, Shield, KeyRound, Fingerprint } from 'lucide-react';

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

  // Social Auth Modals & States
  const [activeSocialModal, setActiveSocialModal] = useState<'google' | 'github' | 'sso' | null>(null);
  const [ssoDomain, setSsoDomain] = useState('');
  const [ssoTab, setSsoTab] = useState<'saml' | 'passkey'>('saml');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

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

  const handleSelectGoogleAccount = (selectedEmail: string) => {
    setIsAuthenticating(true);
    setTimeout(() => {
      setIsAuthenticating(false);
      setActiveSocialModal(null);
      onSuccess(selectedEmail);
    }, 400);
  };

  const handleAuthorizeGitHub = () => {
    setIsAuthenticating(true);
    setTimeout(() => {
      setIsAuthenticating(false);
      setActiveSocialModal(null);
      onSuccess('bahodr-dev@github.com');
    }, 400);
  };

  const handleAuthorizeSSO = () => {
    setIsAuthenticating(true);
    setTimeout(() => {
      setIsAuthenticating(false);
      setActiveSocialModal(null);
      onSuccess(ssoDomain ? `workspace@${ssoDomain}` : 'enterprise@dubbing.io');
    }, 400);
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

          {/* Social Auth Buttons Row (Google, GitHub & SSO) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '24px' }}>
            {/* Google Icon Button */}
            <button
              type="button"
              onClick={() => setActiveSocialModal('google')}
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
              onClick={() => setActiveSocialModal('github')}
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

            {/* Enterprise SSO / Key Button */}
            <button
              type="button"
              onClick={() => setActiveSocialModal('sso')}
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

      {/* ========================================================================= */}
      {/* 1. GOOGLE SIGN-IN INTERACTIVE MODAL POPUP                                  */}
      {/* ========================================================================= */}
      {activeSocialModal === 'google' && (
        <div className="modal-overlay" onClick={() => !isAuthenticating && setActiveSocialModal(null)}>
          <div 
            className="modal-container" 
            style={{ maxWidth: '420px', padding: '28px', animation: 'scaleUp 180ms ease' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>Sign in with Google</span>
              </div>
              <button 
                type="button" 
                onClick={() => setActiveSocialModal(null)} 
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.6)', marginBottom: '18px' }}>
              Choose an account to continue to <strong>dubbing.io</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {/* Account 1 */}
              <div 
                onClick={() => handleSelectGoogleAccount('bahodrbro@gmail.com')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  cursor: 'pointer',
                  backgroundColor: '#ffffff',
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#0284c7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                  B
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>Bahodir (Creator)</div>
                  <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>bahodrbro@gmail.com</div>
                </div>
                <Check size={16} color="#16a34a" />
              </div>

              {/* Account 2 */}
              <div 
                onClick={() => handleSelectGoogleAccount('bahodir@dubbing.io')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid rgba(0,0,0,0.08)',
                  cursor: 'pointer',
                  backgroundColor: '#ffffff',
                  transition: 'all 120ms ease',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.03)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#000000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px' }}>
                  D
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: '#111827' }}>Dubbing.io Studio</div>
                  <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)' }}>bahodir@dubbing.io</div>
                </div>
              </div>
            </div>

            {isAuthenticating && (
              <div style={{ textAlign: 'center', padding: '10px', fontSize: '12.5px', color: 'rgba(0,0,0,0.6)' }}>
                Connecting to Google workspace...
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. GITHUB OAUTH INTERACTIVE MODAL POPUP                                    */}
      {/* ========================================================================= */}
      {activeSocialModal === 'github' && (
        <div className="modal-overlay" onClick={() => !isAuthenticating && setActiveSocialModal(null)}>
          <div 
            className="modal-container" 
            style={{ maxWidth: '440px', padding: '28px', animation: 'scaleUp 180ms ease' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#111827">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <span style={{ fontSize: '15.5px', fontWeight: 700, color: '#111827' }}>Authorize Dubbing.io</span>
              </div>
              <button 
                type="button" 
                onClick={() => setActiveSocialModal(null)} 
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '12px', padding: '16px', marginBottom: '20px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: '18px', fontWeight: 700 }}>
                B
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>bahodr-dev</div>
              <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.5)', marginTop: '2px' }}>bahodrbro@gmail.com</div>
            </div>

            <p style={{ fontSize: '12.5px', color: 'rgba(0,0,0,0.6)', lineHeight: 1.5, marginBottom: '20px' }}>
              <strong>Dubbing.io</strong> will receive access to your public profile and workspace synchronization.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setActiveSocialModal(null)}
                className="btn btn-secondary"
                style={{ flex: 1, height: '42px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAuthorizeGitHub}
                disabled={isAuthenticating}
                style={{
                  flex: 1.5,
                  height: '42px',
                  backgroundColor: '#2da44e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Check size={16} />
                <span>{isAuthenticating ? 'Authorizing...' : 'Authorize bahodr-dev'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ENTERPRISE SSO & PASSKEY INTERACTIVE MODAL POPUP                       */}
      {/* ========================================================================= */}
      {activeSocialModal === 'sso' && (
        <div className="modal-overlay" onClick={() => !isAuthenticating && setActiveSocialModal(null)}>
          <div 
            className="modal-container" 
            style={{ maxWidth: '440px', padding: '28px', animation: 'scaleUp 180ms ease' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={20} color="#111827" />
                <span style={{ fontSize: '15.5px', fontWeight: 700, color: '#111827' }}>Enterprise Access</span>
              </div>
              <button 
                type="button" 
                onClick={() => setActiveSocialModal(null)} 
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Toggle Tabs */}
            <div style={{ display: 'flex', backgroundColor: '#F1F5F9', borderRadius: '8px', padding: '3px', marginBottom: '20px', gap: '2px' }}>
              <button
                type="button"
                onClick={() => setSsoTab('saml')}
                style={{
                  flex: 1,
                  padding: '7px',
                  fontSize: '12.5px',
                  fontWeight: ssoTab === 'saml' ? 600 : 500,
                  backgroundColor: ssoTab === 'saml' ? '#ffffff' : 'transparent',
                  color: ssoTab === 'saml' ? '#111827' : 'rgba(0,0,0,0.55)',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: ssoTab === 'saml' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                SAML / Okta SSO
              </button>
              <button
                type="button"
                onClick={() => setSsoTab('passkey')}
                style={{
                  flex: 1,
                  padding: '7px',
                  fontSize: '12.5px',
                  fontWeight: ssoTab === 'passkey' ? 600 : 500,
                  backgroundColor: ssoTab === 'passkey' ? '#ffffff' : 'transparent',
                  color: ssoTab === 'passkey' ? '#111827' : 'rgba(0,0,0,0.55)',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: ssoTab === 'passkey' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                Biometric Passkey
              </button>
            </div>

            {ssoTab === 'saml' ? (
              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: '#111827', display: 'block', marginBottom: '6px' }}>
                  Workspace Corporate Domain
                </label>
                <input
                  type="text"
                  placeholder="e.g. acme-corp.com or dubbing.io"
                  value={ssoDomain}
                  onChange={e => setSsoDomain(e.target.value)}
                  style={{
                    width: '100%',
                    height: '46px',
                    borderRadius: '8px',
                    border: '1px solid rgba(0,0,0,0.16)',
                    padding: '0 14px',
                    fontSize: '13.5px',
                    marginBottom: '16px',
                    outline: 'none',
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAuthorizeSSO}
                  disabled={isAuthenticating}
                  className="btn btn-primary"
                  style={{ width: '100%', height: '46px', fontSize: '13.5px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <KeyRound size={16} />
                  <span>{isAuthenticating ? 'Connecting SAML SSO...' : 'Continue with Corporate SSO'}</span>
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <Fingerprint size={28} color="#111827" />
                </div>
                <h3 style={{ fontSize: '14.5px', fontWeight: 700, marginBottom: '4px' }}>Touch ID / Face ID / Security Key</h3>
                <p style={{ fontSize: '12.5px', color: 'rgba(0,0,0,0.55)', marginBottom: '18px' }}>
                  Authenticate instantly with your hardware device passkey.
                </p>
                <button
                  type="button"
                  onClick={handleAuthorizeSSO}
                  disabled={isAuthenticating}
                  className="btn btn-primary"
                  style={{ width: '100%', height: '46px', fontSize: '13.5px', fontWeight: 600 }}
                >
                  {isAuthenticating ? 'Verifying Passkey...' : 'Verify Device Passkey'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
