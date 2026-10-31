import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NewDubModal } from '../components/NewDubModal';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    media: { upload: vi.fn(), delete: vi.fn() },
    dubbing: { generate: vi.fn(), transcribe: vi.fn(), getUsage: vi.fn(), checkMinutes: vi.fn() },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => { throw new Error('Metadata unavailable'); });
});
afterEach(() => vi.restoreAllMocks());

describe('New project form', () => {
  it('requires both a project name and a media source', () => {
    render(<NewDubModal isOpen onClose={vi.fn()} onCreateProject={vi.fn()} />);
    const submit = screen.getByRole('button', { name: 'Start dubbing' });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'My video' } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Or paste a direct video or audio file URL'), { target: { value: 'https://example.com/video.mp4' } });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /Use site voices/i }));
    fireEvent.click(screen.getByLabelText('Speech Cadence'));
    fireEvent.click(screen.getByRole('option', { name: /Dynamic Lip Sync/ }));
    expect(submit).toBeEnabled();
  });

  it('keeps the form open and offers retry when uploading fails', async () => {
    vi.mocked(api.dubbing.getUsage).mockResolvedValueOnce({ minutesBalance: 5, usage: [] });
    vi.mocked(api.media.upload).mockRejectedValueOnce(new Error('Offline'));
    const onCreateProject = vi.fn();
    const onClose = vi.fn();
    render(<NewDubModal isOpen onClose={onClose} onCreateProject={onCreateProject} />);
    fireEvent.change(screen.getByLabelText('Choose video file'), {
      target: { files: [new File(['video'], 'Demo.mp4', { type: 'video/mp4' })] },
    });
    expect(screen.getByText(/selected — ready to upload/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /Use site voices/i }));
    fireEvent.click(screen.getByLabelText('Speech Cadence'));
    fireEvent.click(screen.getByRole('option', { name: /Dynamic Lip Sync/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start dubbing' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not upload'));
    expect(onClose).not.toHaveBeenCalled();
    expect(onCreateProject).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start dubbing' })).toBeEnabled();
  });

  it('checks remaining minutes before uploading and stays on the form when none remain', async () => {
    vi.mocked(api.dubbing.getUsage).mockResolvedValueOnce({ minutesBalance: 0, usage: [] });
    const onCreateProject = vi.fn();
    render(<NewDubModal isOpen onClose={vi.fn()} onCreateProject={onCreateProject} />);
    fireEvent.change(screen.getByLabelText('Choose video file'), {
      target: { files: [new File(['video'], 'Demo.mp4', { type: 'video/mp4' })] },
    });
    fireEvent.click(screen.getByRole('radio', { name: /Use site voices/i }));
    fireEvent.click(screen.getByLabelText('Speech Cadence'));
    fireEvent.click(screen.getByRole('option', { name: /Dynamic Lip Sync/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start dubbing' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('No dubbing minutes remain'));
    expect(api.media.upload).not.toHaveBeenCalled();
    expect(onCreateProject).not.toHaveBeenCalled();
  });

  it('removes an uploaded file and stays on the form when its duration exceeds the balance', async () => {
    vi.mocked(api.dubbing.getUsage).mockResolvedValueOnce({ minutesBalance: 5, usage: [] });
    vi.mocked(api.media.upload).mockResolvedValueOnce({
      id: 'media-long', url: '/api/media/media-long', filename: 'long.mp4', originalName: 'long.mp4',
      size: '100 MB', mimeType: 'video/mp4',
    });
    vi.mocked(api.dubbing.checkMinutes).mockResolvedValueOnce({
      canStart: false, duration: 3600, requiredMinutes: 60, minutesBalance: 5,
    });
    vi.mocked(api.media.delete).mockResolvedValueOnce({ message: 'deleted' });
    const onCreateProject = vi.fn();
    render(<NewDubModal isOpen onClose={vi.fn()} onCreateProject={onCreateProject} />);
    fireEvent.change(screen.getByLabelText('Choose video file'), {
      target: { files: [new File(['video'], 'Long.mp4', { type: 'video/mp4' })] },
    });
    fireEvent.click(screen.getByRole('radio', { name: /Use site voices/i }));
    fireEvent.click(screen.getByLabelText('Speech Cadence'));
    fireEvent.click(screen.getByRole('option', { name: /Dynamic Lip Sync/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start dubbing' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('60.00 dubbing minutes'));
    expect(api.media.delete).toHaveBeenCalledWith('media-long');
    expect(onCreateProject).not.toHaveBeenCalled();
  });
});
