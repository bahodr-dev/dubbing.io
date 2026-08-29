import React, { useState } from 'react';
import { api } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string) => void;
  onNavigateToSignUp?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  onNavigateToSignUp,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleAuthMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data && typeof event.data === 'object') {
        if (event.data.type === 'DUBBING_AUTH_SUCCESS') {
          try {
            const meRes = await api.auth.me();
            onSuccess(meRes.user.email);
            onClose();
          } catch (err: unknown) {
            const errorObj = err as Error;
            setError(errorObj.message || 'Authentication failed.');
          }
        } else if (event.data.type === 'DUBBING_AUTH_ERROR') {
          setError('Authentication failed. Please try again.');
        }
      }
    };

    window.addEventListener('message', handleAuthMessage);
    return () => window.removeEventListener('message', handleAuthMessage);
  }, [isOpen, onSuccess, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
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
    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        const res = await api.auth.signup(email, password);
        onSuccess(res.user.email);
        onClose();
      } else {
        const res = await api.auth.signin(email, password);
        onSuccess(res.user.email);
        onClose();
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleAuth = () => {
    setError('');
    const width = 540;
    const height = 650;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);

    const popup = window.open(
      '/api/auth/google',
      'dubbing_oauth_google',
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      window.location.assign('/api/auth/google');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-container" 
        style={{ maxWidth: '440px' }} 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
              {mode === 'signin' ? 'Sign in to dubbing.io' : 'Create your account'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--black-60)', marginTop: '2px' }}>
              {mode === 'signin' ? 'Welcome back to your studio' : 'Start dubbing your videos today'}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="btn-ghost" 
            style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* SSO Options */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            className="btn btn-secondary"
            style={{ width: '100%', marginBottom: '20px', fontWeight: 500 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.053 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
            </svg>
            Continue with Google
          </button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '20px 0',
            color: 'var(--black-40)',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--black-12)' }}></div>
            <span>or</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--black-12)' }}></div>
          </div>

          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                padding: '10px 14px',
                border: '1px solid var(--black-100)',
                backgroundColor: 'var(--black-05)',
                fontSize: '13px',
                marginBottom: '16px',
                borderRadius: 'var(--radius-xs)',
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label className="label">Email address</label>
              <input
                type="email"
                className="input"
                placeholder="name@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label className="label">Password</label>
              <input
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px 18px', fontSize: '15px' }}
            >
              {isSubmitting ? 'Signing in...' : 'Continue →'}
            </button>
          </form>

          <div style={{
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '13px',
            color: 'var(--black-60)',
          }}>
            {mode === 'signin' ? (
              <>
                Don't have an account?{' '}
                <button
                  onClick={() => {
                    if (onNavigateToSignUp) {
                      onNavigateToSignUp();
                    } else {
                      setMode('signup');
                      setError('');
                    }
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--black-100)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Create account
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  onClick={() => { setMode('signin'); setError(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--black-100)', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
