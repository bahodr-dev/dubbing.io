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
  vi.clearAllMocks();
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => { throw new Error('Metadata unavailable'); });
});
afterEach(() => vi.restoreAllMocks());

describe('Dashboard Start dubbing minute check', () => {
  it('warns on missing file and voice selection before making requests', () => {
    const { container } = render(<WorkspaceCreator voices={[]} onProjectCreated={vi.fn()} />);
    const start = screen.getByRole('button', { name: 'Start dubbing project' });
    expect(start).toBeEnabled();
    fireEvent.click(start);
    expect(screen.getByRole('alert')).toHaveTextContent('Avval fayl tanlang');
    selectFile(container);
    fireEvent.click(start);
    expect(screen.getByRole('alert')).toHaveTextContent('variantidan birini tanlang');
    expect(api.dubbing.getUsage).not.toHaveBeenCalled();
  });

  it('shows the extra credit cost only when cloning is selected', () => {
    render(<WorkspaceCreator voices={[]} onProjectCreated={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Voice'));
    fireEvent.click(screen.getByRole('option', { name: /Voice cloning/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Uses 1.5× credits.');
    fireEvent.click(screen.getByLabelText('Voice'));
    fireEvent.click(screen.getByRole('option', { name: /Automatic/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Automatic detects speakers and assigns voices from our library');
    expect(screen.getByRole('status')).not.toHaveTextContent('1.5×');
  });
  function selectFile(container: HTMLElement) {
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['video'], 'Long.mp4', { type: 'video/mp4' })] } });
  }

  it('requires cadence and explains each choice in the shared notice', () => {
    const { container } = render(<WorkspaceCreator voices={[]} onProjectCreated={vi.fn()} />);
    selectFile(container);
    fireEvent.click(screen.getByLabelText('Voice'));
    fireEvent.click(screen.getByRole('option', { name: /Automatic/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start dubbing project' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a Speech Cadence');
    expect(api.dubbing.getUsage).not.toHaveBeenCalled();
    for (const [name, description] of [
      ['Dynamic Lip Sync', 'original timestamps'],
      ['Fast Cadence', '15%'],
      ['Narrative Pacing', '10%'],
    ]) {
      fireEvent.click(screen.getByLabelText('Speech Cadence'));
      fireEvent.click(screen.getByRole('option', { name: new RegExp(name) }));
      expect(screen.getByRole('status')).toHaveTextContent(description);
    }
  });

  it('passes the chosen cadence into the dubbing start options', async () => {
    vi.mocked(api.dubbing.getUsage).mockResolvedValueOnce({ minutesBalance: 5, usage: [] });
    vi.mocked(api.media.upload).mockResolvedValueOnce({
      id: 'media-fast', url: '/api/media/media-fast', filename: 'fast.mp4', originalName: 'fast.mp4',
      size: '10 MB', mimeType: 'video/mp4',
    });
    vi.mocked(api.dubbing.checkMinutes).mockResolvedValueOnce({ canStart: true, duration: 30, requiredMinutes: 0.5, minutesBalance: 5 });
    const onProjectCreated = vi.fn();
    const { container } = render(<WorkspaceCreator voices={[]} onProjectCreated={onProjectCreated} />);
    selectFile(container);
    fireEvent.click(screen.getByLabelText('Voice'));
    fireEvent.click(screen.getByRole('option', { name: /Automatic/ }));
    fireEvent.click(screen.getByLabelText('Speech Cadence'));
    fireEvent.click(screen.getByRole('option', { name: /Fast Cadence/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start dubbing project' }));
    await waitFor(() => expect(onProjectCreated).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ speechCadence: 'fast' })));
  });

  it('checks live balance before uploading the video', async () => {
    vi.mocked(api.dubbing.getUsage).mockResolvedValueOnce({ minutesBalance: 0, usage: [] });
    const onProjectCreated = vi.fn();
    const { container } = render(<WorkspaceCreator voices={[]} onProjectCreated={onProjectCreated} />);
    selectFile(container);
    fireEvent.click(screen.getByLabelText('Voice'));
    fireEvent.click(screen.getByRole('option', { name: /Automatic/ }));
    fireEvent.click(screen.getByLabelText('Speech Cadence'));
    fireEvent.click(screen.getByRole('option', { name: /Dynamic Lip Sync/ }));
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
    fireEvent.click(screen.getByLabelText('Voice'));
    fireEvent.click(screen.getByRole('option', { name: /Automatic/ }));
    fireEvent.click(screen.getByLabelText('Speech Cadence'));
    fireEvent.click(screen.getByRole('option', { name: /Dynamic Lip Sync/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start dubbing project' }));

    await waitFor(() => expect(screen.getByText(/60.00 dubbing minutes/)).toBeInTheDocument());
    expect(api.media.delete).toHaveBeenCalledWith('media-long');
    expect(onProjectCreated).not.toHaveBeenCalled();
    expect(api.dubbing.transcribe).not.toHaveBeenCalled();
  });

});
