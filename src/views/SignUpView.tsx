import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { ActiveTab } from '../types';

interface SignUpViewProps {
  onNavigate?: (tab: ActiveTab) => void;
  onSuccess: (email: string) => void;
  onOpenSignIn: () => void;
}

export const SignUpView: React.FC<SignUpViewProps> = ({
  onSuccess,
  onOpenSignIn,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    onSuccess(email);
  };

  const handleGoogleAuth = () => {
    onSuccess('bahodir@dubbing.io');
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

      {/* RIGHT PANEL: Minimal Registration Form (50%) */}
      <div className="signup-right-panel">
        {/* Centered Sign Up Form Container */}
        <div className="signup-anim-form" style={{ width: '100%', maxWidth: '420px' }}>
          {/* Form Header */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{
              fontSize: 'clamp(32px, 3.5vw, 40px)',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              color: 'var(--black-100)',
              marginBottom: '10px',
            }}>
              Create your account
            </h2>
            <p style={{
              fontSize: '15px',
              color: 'rgba(0, 0, 0, 0.55)',
              lineHeight: 1.5,
              fontWeight: 400,
            }}>
              Start dubbing in any language.
            </p>
          </div>

          {/* Google Auth Button */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            style={{
              width: '100%',
              height: '50px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              backgroundColor: 'var(--c-white)',
              border: '1px solid rgba(0, 0, 0, 0.16)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-sans)',
              fontSize: '14.5px',
              fontWeight: 500,
              color: 'var(--black-100)',
              cursor: 'pointer',
              transition: 'border-color 180ms ease, background-color 180ms ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.4)';
              e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.015)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.16)';
              e.currentTarget.style.backgroundColor = 'var(--c-white)';
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.053 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Minimal Divider */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            margin: '26px 0',
            color: 'rgba(0, 0, 0, 0.4)',
          }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(0, 0, 0, 0.12)' }}></div>
            <span style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              OR
            </span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(0, 0, 0, 0.12)' }}></div>
          </div>

          {/* Registration Form */}
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                padding: '10px 14px',
                border: '1px solid var(--black-100)',
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                fontSize: '13px',
                marginBottom: '18px',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--black-100)',
              }}>
                {error}
              </div>
            )}

            {/* Email Field */}
            <div style={{ marginBottom: '18px' }}>
              <label className="label" htmlFor="signup-email">
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                className="input"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
                autoFocus
                style={{ height: '48px' }}
              />
            </div>

            {/* Password Field */}
            <div style={{ marginBottom: '24px' }}>
              <label className="label" htmlFor="signup-password">
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  className="input"
                  placeholder="•••••••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  style={{ height: '48px', paddingRight: '42px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'rgba(0, 0, 0, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button (without arrow) */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{
                width: '100%',
                height: '50px',
                fontSize: '14.5px',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
              }}
            >
              Create account
            </button>
          </form>

          {/* Under-button Auth Link (without arrow) */}
          <div style={{
            marginTop: '20px',
            textAlign: 'center',
            fontSize: '14px',
            color: 'rgba(0, 0, 0, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}>
            <span>Already have an account?</span>
            <button
              type="button"
              onClick={onOpenSignIn}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--black-100)',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '14px',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              Sign in
            </button>
          </div>

          {/* Terms & Privacy Notice */}
          <p style={{
            fontSize: '11.5px',
            color: 'rgba(0, 0, 0, 0.45)',
            textAlign: 'center',
            marginTop: '20px',
            lineHeight: 1.5,
          }}>
            By continuing, you agree to our{' '}
            <span style={{ color: 'var(--black-100)', cursor: 'pointer', textDecoration: 'underline' }}>Terms</span>
            {' '}and{' '}
            <span style={{ color: 'var(--black-100)', cursor: 'pointer', textDecoration: 'underline' }}>Privacy Policy</span>.
          </p>
        </div>
      </div>
    </div>
  );
};
