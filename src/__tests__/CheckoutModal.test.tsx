import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CheckoutModal } from '../components/CheckoutModal';
import { api } from '../services/api';
import { ToastProvider } from '../context/ToastContext';

function renderCheckout(onClose = vi.fn()) {
  render(
    <ToastProvider>
      <CheckoutModal isOpen onClose={onClose} />
    </ToastProvider>
  );
  return onClose;
}

describe('CheckoutModal accessibility', () => {
  beforeEach(() => {
    vi.spyOn(api.payments, 'getPlans').mockResolvedValue({ plans: [], supportedProviders: [
      { id: 'payme', enabled: true }, { id: 'click', enabled: true },
    ] });
  });
  afterEach(() => vi.restoreAllMocks());
  it('exposes an accessible modal and keyboard-selectable payment methods', async () => {
    renderCheckout();

    expect(screen.getByRole('dialog', { name: /upgrade to creator plan/i })).toHaveAttribute(
      'aria-modal',
      'true'
    );
    expect(screen.getByRole('button', { name: /close checkout/i })).toHaveFocus();

    const clickProvider = screen.getByRole('button', { name: /click click up/i });
    await waitFor(() => expect(clickProvider).toBeEnabled());
    fireEvent.click(clickProvider);
    expect(clickProvider).toHaveAttribute('aria-pressed', 'true');
  });

  it('closes with Escape', () => {
    const onClose = renderCheckout();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('disables unavailable providers and never offers Uzum as a working gateway', async () => {
    vi.mocked(api.payments.getPlans).mockResolvedValue({ plans: [], supportedProviders: [] });
    renderCheckout();
    await waitFor(() => expect(api.payments.getPlans).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /pay with payme/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /uzum pay visa/i })).toBeDisabled();
  });

  it('waits for server confirmation before reporting a returned payment as successful', async () => {
    const onSuccess = vi.fn();
    const onClose = vi.fn();
    vi.spyOn(api.payments, 'getOrder').mockResolvedValue({ order: { id: 'ord-returned', status: 'completed' }, subscription: {} });
    render(<ToastProvider><CheckoutModal isOpen onClose={onClose} onSuccess={onSuccess} initialOrderId="ord-returned" /></ToastProvider>);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(api.payments.getOrder).toHaveBeenCalledWith('ord-returned');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not activate a cancelled payment after returning from the gateway', async () => {
    const onSuccess = vi.fn();
    vi.spyOn(api.payments, 'getOrder').mockResolvedValue({ order: { id: 'ord-cancelled', status: 'cancelled' }, subscription: {} });
    render(<ToastProvider><CheckoutModal isOpen onClose={vi.fn()} onSuccess={onSuccess} initialOrderId="ord-cancelled" /></ToastProvider>);
    await screen.findByText(/this payment was cancelled/i);
    expect(onSuccess).not.toHaveBeenCalled();
  });

});
