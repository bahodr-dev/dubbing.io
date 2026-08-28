import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectCard } from '../components/dashboard/ProjectCard';
import type { Project } from '../types';

describe('ProjectCard Component', () => {
  const mockProject: Project = {
    id: 'proj-test-123',
    title: 'AI Studio Keynote Speech',
    originalLanguage: 'en',
    targetLanguage: 'uz',
    status: 'completed',
    duration: 35.5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    videoUrl: 'https://example.com/video.mp4',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    voiceId: 'voice-farrux',
    transcript: [],
  };

  it('renders project title, language pair, and duration correctly', () => {
    const handleOpen = vi.fn();
    const handleDelete = vi.fn();

    render(
      <ProjectCard
        project={mockProject}
        onOpen={handleOpen}
        onDelete={handleDelete}
      />
    );

    expect(screen.getByText('AI Studio Keynote Speech')).toBeInTheDocument();
    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('Uzbek')).toBeInTheDocument();
    expect(screen.getByText('35s')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('triggers onOpen when clicked', () => {
    const handleOpen = vi.fn();
    const handleDelete = vi.fn();

    render(
      <ProjectCard
        project={mockProject}
        onOpen={handleOpen}
        onDelete={handleDelete}
      />
    );

    fireEvent.click(screen.getByText('AI Studio Keynote Speech'));
    expect(handleOpen).toHaveBeenCalledWith(mockProject);
  });
});
