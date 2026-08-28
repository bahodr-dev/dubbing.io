import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthModal } from '../components/AuthModal';

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

  it('renders sign in form when isOpen is true and submits successfully', () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

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

    expect(handleSuccess).toHaveBeenCalledWith('user@dubbing.io');
    expect(handleClose).toHaveBeenCalled();
  });
});
