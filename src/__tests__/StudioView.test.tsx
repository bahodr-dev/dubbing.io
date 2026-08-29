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

    expect(screen.getByText('Product Keynote 2026')).toBeInTheDocument();
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
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(api.dubbing.process).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'proj-123',
          originalLanguage: 'en',
          targetLanguage: 'uz',
          voiceId: 'voice-farrux',
        })
      );
    });
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
});
