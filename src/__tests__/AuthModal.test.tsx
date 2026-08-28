import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthModal } from '../components/AuthModal';
import { api } from '../services/api';

describe('AuthModal Component', () => {
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

    expect(screen.queryByText('Sign in to dubbing.io')).not.toBeInTheDocument();
  });

  it('renders sign in form when isOpen is true and submits successfully', async () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    vi.spyOn(api.auth, 'signin').mockResolvedValue({
      token: 'test_token',
      user: {
        id: 'usr_123',
        email: 'user@dubbing.io',
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

    expect(screen.getByText('Sign in to dubbing.io')).toBeInTheDocument();

    const emailInput = screen.getByPlaceholderText('name@company.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');

    fireEvent.change(emailInput, { target: { value: 'user@dubbing.io' } });
    fireEvent.change(passwordInput, { target: { value: 'Secret123!' } });

    const submitBtn = screen.getByRole('button', { name: /^continue →/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledWith('user@dubbing.io');
      expect(handleClose).toHaveBeenCalled();
    });
  });
});
