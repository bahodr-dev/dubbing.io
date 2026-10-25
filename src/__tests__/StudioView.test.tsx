import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { StudioView } from '../views/StudioView';
import { ToastProvider } from '../context/ToastContext';
import { api } from '../services/api';
import type { Project } from '../types';

vi.mock('../services/api', () => ({
  api: {
    projects: {
      update: vi.fn().mockResolvedValue({ success: true }),
      updateTranscript: vi.fn().mockResolvedValue({ success: true }),
    },
    dubbing: {
      getCapabilities: vi.fn().mockResolvedValue({ canRenderFinalDub: true, canCloneVoices: true, requiredForFinalRender: [] }),
      process: vi.fn().mockResolvedValue({ jobId: 'job-test-123', status: 'pending' }),
      getJob: vi.fn().mockResolvedValue({
        job: {
          id: 'job-test-123',
          status: 'completed',
          progress: 100,
          currentStage: 'Completed',
          result: {
            transcript: [],
            audioUrl: '/api/media/med-dub-output-123',
          },
        },
      }),
      getLatestProjectJob: vi.fn().mockResolvedValue({}),
      downloadSubtitles: vi.fn().mockResolvedValue(new Blob(['SRT_CONTENT'])),
    },
  },
}));

describe('StudioView Component', () => {
  const mockProject: Project = {
    id: 'proj-123',
    title: 'Product Keynote 2026',
    originalLanguage: 'en',
    targetLanguage: 'uz',
    status: 'draft',
    duration: 30,
    createdAt: '2026-08-29T10:00:00Z',
    updatedAt: '2026-08-29T10:00:00Z',
    videoUrl: '/api/media/med-sample-123',
    thumbnailUrl: '',
    voiceId: 'voice-farrux',
    transcript: [
      {
        id: 'seg-1',
        startTime: 0,
        endTime: 4.5,
        originalText: 'Welcome everyone.',
        translatedText: 'Barchaga xush kelibsiz.',
        speaker: 'Speaker 01',
        speakerSource: 'diarization',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders existing Studio layout with breadcrumbs and project title', () => {
    render(
      <BrowserRouter>
        <ToastProvider>
          <StudioView project={mockProject} />
        </ToastProvider>
      </BrowserRouter>
    );

    expect(screen.getByText('Product Keyn...')).toBeInTheDocument();
    expect(screen.getByText('Dubbing Configuration')).toBeInTheDocument();
    expect(screen.getByText('Generate dub →')).toBeInTheDocument();
  });

  it('starts dubbing process on button click and calls api.dubbing.process', async () => {
    render(
      <BrowserRouter>
        <ToastProvider>
          <StudioView project={mockProject} />
        </ToastProvider>
      </BrowserRouter>
    );

    const generateBtn = screen.getByText('Generate dub →');
    fireEvent.click(screen.getByLabelText(/I confirm I have permission from every speaker/i));
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(api.dubbing.process).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-123',
          originalLanguage: 'en',
          targetLanguage: 'uz',
          voiceId: 'voice-farrux',
          autoCloneVoices: true,
          voiceCloningConsent: true,
        })
      );
    });
    expect(api.projects.updateTranscript).toHaveBeenCalledWith('proj-123', mockProject.transcript);
    expect(api.projects.update).toHaveBeenCalledWith('proj-123', expect.objectContaining({
      voiceId: 'voice-farrux', speakerVoices: {},
    }));
    expect(vi.mocked(api.projects.update).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(api.projects.updateTranscript).mock.invocationCallOrder[0]);
    expect(vi.mocked(api.projects.updateTranscript).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(api.dubbing.process).mock.invocationCallOrder[0]);
  });

  it('renders project not found view when project is null', () => {
    render(
      <BrowserRouter>
        <ToastProvider>
          <StudioView project={undefined} projects={[]} />
        </ToastProvider>
      </BrowserRouter>
    );

    expect(screen.getByText('Project Not Found')).toBeInTheDocument();
    expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
  });

  it('keeps the previous language and reports a failed settings save', async () => {
    vi.mocked(api.projects.update).mockRejectedValueOnce(new Error('Network down'));
    const onSettingsSaved = vi.fn();
    render(
      <BrowserRouter>
        <ToastProvider>
          <StudioView project={mockProject} onSettingsSaved={onSettingsSaved} />
        </ToastProvider>
      </BrowserRouter>
    );

    const originalLanguage = screen.getByLabelText('Original language') as HTMLSelectElement;
    fireEvent.change(originalLanguage, { target: { value: 'es' } });

    await waitFor(() => expect(screen.getByText('Network down')).toBeInTheDocument());
    expect(originalLanguage.value).toBe('en');
    expect(onSettingsSaved).not.toHaveBeenCalled();
    expect(api.projects.update).toHaveBeenCalledTimes(1);
  });

  it('updates the primary voice after one successful save', async () => {
    const onSettingsSaved = vi.fn();
    render(
      <BrowserRouter>
        <ToastProvider>
          <StudioView project={mockProject} onSettingsSaved={onSettingsSaved} />
        </ToastProvider>
      </BrowserRouter>
    );

    fireEvent.click(screen.getByText('Change voice →'));
    fireEvent.click(screen.getByRole('button', { name: 'Select Dilnoza' }));

    await waitFor(() => expect(onSettingsSaved).toHaveBeenCalledWith('proj-123', expect.objectContaining({
      voiceId: 'voice-dilnoza',
    })));
    expect(api.projects.update).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Dilnoza')).toBeInTheDocument();
  });
});
