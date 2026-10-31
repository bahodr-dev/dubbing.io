import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProcessingPage } from '../views/ProcessingPage';
import type { Project } from '../types';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: { dubbing: { getLatestProjectJob: vi.fn(), process: vi.fn(), retryJob: vi.fn() } },
}));
vi.mock('../components/ProcessingView', () => ({
  ProcessingView: ({ jobId, onComplete }: { jobId: string; onComplete: () => void }) =>
    <div>Job {jobId}<button onClick={onComplete}>Finish</button></div>,
}));

const project: Project = {
  id: 'proj-1', title: 'Demo', originalLanguage: 'auto', targetLanguage: 'uz',
  status: 'processing', duration: 15, createdAt: '', updatedAt: '',
  videoUrl: '/api/media/media-1', mediaId: 'media-1', thumbnailUrl: '',
  voiceId: 'voice-farrux', transcript: [],
};

function renderPage(onCompleted = vi.fn()) {
  render(<MemoryRouter initialEntries={['/processing/proj-1']}><Routes>
    <Route path="/processing/:projectId" element={<ProcessingPage
      project={project} isProjectLoading={false} onCompleted={onCompleted}
    />} />
  </Routes></MemoryRouter>);
}

describe('processing page', () => {
  it('restores the saved job after a page reload and opens the finished project', async () => {
    vi.mocked(api.dubbing.getLatestProjectJob).mockResolvedValueOnce({ jobId: 'job-1', status: 'rendering', job: {} });
    const onCompleted = vi.fn().mockResolvedValue(undefined);
    renderPage(onCompleted);
    await waitFor(() => expect(screen.getByText('Job job-1')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith('proj-1'));
  });

  it('offers a recoverable start when the saved project has no job', async () => {
    vi.mocked(api.dubbing.getLatestProjectJob).mockRejectedValueOnce(new Error('No job'));
    vi.mocked(api.dubbing.process).mockResolvedValueOnce({
      jobId: 'job-2', status: 'queued', reservedMinutes: 1, minutesBalance: 4, message: 'Started',
    });
    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: 'Use site voices' }));
    fireEvent.click(screen.getByLabelText('Speech Cadence'));
    fireEvent.click(screen.getByRole('option', { name: /Fast Cadence/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(api.dubbing.process).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'proj-1', autoAssignSiteVoices: true, autoCloneVoices: false, speechCadence: 'fast',
    })));
    expect(screen.getByText('Job job-2')).toBeInTheDocument();
  });
});
