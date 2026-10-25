import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthModal } from '../components/AuthModal';
import { api } from '../services/api';

describe('AuthModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    render(
      <AuthModal
        isOpen={false}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    expect(screen.queryByText('Sign in to dubla.uz')).not.toBeInTheDocument();
  });

  it('renders sign in form when isOpen is true and submits successfully via cookie', async () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    vi.spyOn(api.auth, 'signin').mockResolvedValue({
      user: {
        id: 'usr_123',
        email: 'user@dubla.uz',
        name: 'User',
        provider: 'email',
        avatarUrl: '',
        createdAt: new Date().toISOString(),
      },
    });

    render(
      <AuthModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    expect(screen.getByText('Sign in to dubla.uz')).toBeInTheDocument();

    const emailInput = screen.getByPlaceholderText('name@company.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');

    fireEvent.change(emailInput, { target: { value: 'user@dubla.uz' } });
    fireEvent.change(passwordInput, { target: { value: 'Secret123!' } });

    const submitBtn = screen.getByRole('button', { name: /^continue →/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledWith('user@dubla.uz');
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('handles secure OAuth postMessage signal without JWT and syncs session via api.auth.me', async () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    vi.spyOn(api.auth, 'me').mockResolvedValue({
      user: {
        id: 'usr_google_456',
        email: 'google_user@dubla.uz',
        name: 'Google User',
        provider: 'google',
        avatarUrl: '',
        createdAt: new Date().toISOString(),
      },
    });

    render(
      <AuthModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    // Dispatch secure postMessage from valid origin with NO token payload
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'DUBLA_AUTH_SUCCESS' },
        origin: window.location.origin,
      })
    );

    await waitFor(() => {
      expect(api.auth.me).toHaveBeenCalled();
      expect(handleSuccess).toHaveBeenCalledWith('google_user@dubla.uz');
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('ignores postMessage from untrusted origin', async () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    vi.spyOn(api.auth, 'me');

    render(
      <AuthModal
        isOpen={true}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    // Dispatch message from malicious origin
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'DUBLA_AUTH_SUCCESS' },
        origin: 'https://attacker.evil.com',
      })
    );

    await waitFor(() => {
      expect(api.auth.me).not.toHaveBeenCalled();
      expect(handleSuccess).not.toHaveBeenCalled();
    });
  });
});
