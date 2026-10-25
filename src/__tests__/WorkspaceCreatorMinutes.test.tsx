import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkspaceCreator } from '../components/dashboard/WorkspaceCreator';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    media: { upload: vi.fn(), delete: vi.fn() },
    dubbing: { getUsage: vi.fn(), checkMinutes: vi.fn(), transcribe: vi.fn() },
  },
}));

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => { throw new Error('Metadata unavailable'); });
});
afterEach(() => vi.restoreAllMocks());

describe('Dashboard Start dubbing minute check', () => {
  function selectFile(container: HTMLElement) {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['video'], 'Long.mp4', { type: 'video/mp4' })] } });
  }

  it('checks live balance before uploading the video', async () => {
    vi.mocked(api.dubbing.getUsage).mockResolvedValueOnce({ minutesBalance: 0, usage: [] });
    const onProjectCreated = vi.fn();
    const { container } = render(<WorkspaceCreator voices={[]} onProjectCreated={onProjectCreated} />);
    selectFile(container);
    fireEvent.click(screen.getByRole('button', { name: 'Start dubbing project' }));

    await waitFor(() => expect(screen.getByText(/No dubbing minutes remain/)).toBeInTheDocument());
    expect(api.media.upload).not.toHaveBeenCalled();
    expect(onProjectCreated).not.toHaveBeenCalled();
  });

  it('does not enter the studio if the server detects insufficient minutes', async () => {
    vi.mocked(api.dubbing.getUsage).mockResolvedValueOnce({ minutesBalance: 5, usage: [] });
    vi.mocked(api.media.upload).mockResolvedValueOnce({
      id: 'media-long', url: '/api/media/media-long', filename: 'long.mp4', originalName: 'Long.mp4',
      size: '100 MB', mimeType: 'video/mp4',
    });
    vi.mocked(api.dubbing.checkMinutes).mockResolvedValueOnce({
      canStart: false, duration: 3600, requiredMinutes: 60, minutesBalance: 5,
    });
    vi.mocked(api.media.delete).mockResolvedValueOnce({ message: 'deleted' });
    const onProjectCreated = vi.fn();
    const { container } = render(<WorkspaceCreator voices={[]} onProjectCreated={onProjectCreated} />);
    selectFile(container);
    fireEvent.click(screen.getByRole('button', { name: 'Start dubbing project' }));

    await waitFor(() => expect(screen.getByText(/60.00 dubbing minutes/)).toBeInTheDocument());
    expect(api.media.delete).toHaveBeenCalledWith('media-long');
    expect(onProjectCreated).not.toHaveBeenCalled();
    expect(api.dubbing.transcribe).not.toHaveBeenCalled();
  });

});
