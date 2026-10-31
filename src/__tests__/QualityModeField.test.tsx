import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QualityModeField } from '../components/QualityModeField';
import { api } from '../services/api';

afterEach(() => vi.restoreAllMocks());
describe('Cinema quality availability', () => {
  it('keeps Cinema disabled for accounts outside the internal rollout', async () => {
    vi.spyOn(api.dubbing, 'getCapabilities').mockResolvedValue({ canRenderFinalDub: true, requiredForFinalRender: [], renderableVoiceIds: [], canCloneVoices: true,
      cinema: { ready: false, enabled: false, maxDuration: 300 } });
    render(<QualityModeField value="standard" onChange={vi.fn()} />);
    await waitFor(() => expect(api.dubbing.getCapabilities).toHaveBeenCalled());
    expect(screen.getByRole('option', { name: /Cinema quality/ })).toBeDisabled();
  });
  it('lets a configured tester select Cinema', async () => {
    vi.spyOn(api.dubbing, 'getCapabilities').mockResolvedValue({ canRenderFinalDub: true, requiredForFinalRender: [], renderableVoiceIds: [], canCloneVoices: true,
      cinema: { ready: true, enabled: true, maxDuration: 300 } });
    const onChange = vi.fn(); render(<QualityModeField value="standard" onChange={onChange} />);
    await waitFor(() => expect(screen.getByRole('option', { name: /Cinema quality/ })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Dubbing quality'), { target: { value: 'cinema' } });
    expect(onChange).toHaveBeenCalledWith('cinema');
  });
});
