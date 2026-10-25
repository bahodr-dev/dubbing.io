import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Check } from 'lucide-react';
import { Logo } from '../components/Logo';
import { api } from '../services/api';

export const ResetPasswordView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const hasValidTokenShape = /^[a-f0-9]{64}$/i.test(token);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!hasValidTokenShape) {
      setError('This password reset link is invalid. Request a new link.');
      return;
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError('Password must be at least 8 characters and include a letter and number.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.auth.resetPassword(token, password);
      setIsComplete(true);
      setPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not reset your password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: '48px',
    borderRadius: '9999px',
    border: '1px solid rgba(0, 0, 0, 0.16)',
    padding: '0 20px',
    fontSize: 'var(--text-input)',
    color: '#111827',
    backgroundColor: '#ffffff',
    outline: 'none',
  };

  return (
    <div className="signup-page-wrapper">
      <div className="signup-left-panel">
        <div className="signup-anim-brand" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', zIndex: 2 }}>
          <Logo size={24} />
          <span style={{ fontSize: '15.5px', fontWeight: 800, color: '#fff' }}>dubla.uz</span>
        </div>
        <div style={{ margin: 'auto 0', paddingLeft: 'clamp(0px, 8vw, 48px)', zIndex: 2 }}>
          <h1 className="signup-editorial-title">NEW<br />PASSWORD.</h1>
        </div>
      </div>

      <div className="signup-right-panel">
        <div className="signup-anim-form" style={{ width: '100%', maxWidth: '380px' }}>
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '8px' }}>
              {isComplete ? 'Password updated' : 'Choose a new password'}
            </h2>
            <p style={{ fontSize: 'var(--text-body)', color: 'rgba(0,0,0,.58)', lineHeight: 1.5 }}>
              {isComplete
                ? 'Your old sessions have been closed. You can now sign in with your new password.'
                : 'Use at least 8 characters with one letter and one number.'}
            </p>
          </div>

          {error && (
            <div role="alert" style={{ display: 'flex', gap: '10px', padding: '11px 14px', marginBottom: '16px', borderRadius: '10px', background: '#fef2f2', color: '#991b1b' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 'var(--text-control)' }}>{error}</span>
            </div>
          )}

          {isComplete ? (
            <div>
              <div style={{ display: 'flex', gap: '10px', padding: '12px 14px', marginBottom: '20px', borderRadius: '10px', background: '#111827', color: '#fff' }}>
                <Check size={17} />
                <span style={{ fontSize: 'var(--text-control)' }}>Your password was changed successfully.</span>
              </div>
              <button type="button" className="btn btn-primary" style={{ width: '100%', height: '48px', borderRadius: '9999px' }} onClick={() => window.location.assign('/signin')}>
                Continue to sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  required
                  style={inputStyle}
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  style={inputStyle}
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !hasValidTokenShape}
                className="btn btn-primary"
                style={{ width: '100%', height: '48px', borderRadius: '9999px', opacity: hasValidTokenShape ? 1 : 0.5 }}
              >
                {isSubmitting ? 'Updating password…' : 'Update password'}
              </button>
              <button type="button" className="btn btn-ghost" style={{ width: '100%', marginTop: '10px' }} onClick={() => navigate('/signin')}>
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
