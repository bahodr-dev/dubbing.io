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

    expect(screen.getByText('AI Studio Ke...')).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: 'Open project AI Studio Keynote Speech' }));
    expect(handleOpen).toHaveBeenCalledWith(mockProject);
  });

  it('renders failed status correctly with badge-failed class', () => {
    const failedProj: Project = {
      ...mockProject,
      id: 'proj-failed',
      status: 'failed',
    };

    render(
      <ProjectCard
        project={failedProj}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const badge = screen.getByText('failed');
    expect(badge).toBeInTheDocument();
    expect(badge.className).toContain('badge-failed');
  });

  it('renders determinate processing progress with accessible progressbar semantics', () => {
    const processingProj: Project = {
      ...mockProject,
      id: 'proj-proc',
      status: 'processing',
      processingProgress: 65,
    };

    render(
      <ProjectCard
        project={processingProj}
        onOpen={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute('aria-valuenow', '65');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByText('65%')).toBeInTheDocument();
  });

  it('opens project via keyboard with Enter and Space', () => {
    const handleOpen = vi.fn();

    render(
      <ProjectCard
        project={mockProject}
        onOpen={handleOpen}
        onDelete={vi.fn()}
      />
    );

    const card = screen.getByRole('button', { name: /open project ai studio keynote speech/i });
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(handleOpen).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: ' ' });
    expect(handleOpen).toHaveBeenCalledTimes(2);
  });

  it('actions button has accessible name and does not trigger onOpen', () => {
    const handleOpen = vi.fn();
    const handleDelete = vi.fn();

    render(
      <ProjectCard
        project={mockProject}
        onOpen={handleOpen}
        onDelete={handleDelete}
      />
    );

    const actionsBtn = screen.getByRole('button', { name: `Actions for ${mockProject.title}` });
    expect(actionsBtn).toBeInTheDocument();

    fireEvent.click(actionsBtn);
    expect(handleOpen).not.toHaveBeenCalled();
    expect(screen.getByRole('menu', { name: `Actions for ${mockProject.title}` })).toBeInTheDocument();
  });

  it('uses keyboard actions without accidentally opening the project', () => {
    const onOpen = vi.fn();
    render(<ProjectCard project={mockProject} onOpen={onOpen} onDelete={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: `Actions for ${mockProject.title}` });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    fireEvent.keyDown(trigger, { key: ' ' });
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Open project' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Rename project' })).toHaveFocus();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
