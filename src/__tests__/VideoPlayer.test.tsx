import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VideoPlayer } from '../components/VideoPlayer';
import type { Project } from '../types';

vi.mock('../audio/audioSynth', () => ({ playVoiceSample: vi.fn(), stopVoiceSample: vi.fn() }));

const project: Project = {
  id: 'preview-test', title: 'Preview test', originalLanguage: 'en', targetLanguage: 'uz',
  status: 'draft', duration: 12, videoUrl: '/sample.mp4', thumbnailUrl: '', voiceId: 'voice-farrux',
  createdAt: '2026-09-17', updatedAt: '2026-09-17',
  transcript: [{ id: 'first', startTime: 0, endTime: 12, originalText: 'Original caption', translatedText: 'Translated caption', speaker: 'Speaker 1' }],
};

afterEach(() => vi.restoreAllMocks());

describe('Video preview controls', () => {
  it('seeks by five seconds without going outside the media duration', () => {
    const onTimeUpdate = vi.fn();
    const { container } = render(<VideoPlayer project={project} activeTrack="original" onChangeTrack={vi.fn()} onTimeUpdate={onTimeUpdate} />);
    const video = container.querySelector('video')!;
    fireEvent.click(screen.getByRole('button', { name: 'Back 5 seconds' }));
    expect(video.currentTime).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Forward 5 seconds' }));
    expect(video.currentTime).toBe(5);
    fireEvent.click(screen.getByRole('button', { name: 'Forward 5 seconds' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forward 5 seconds' }));
    expect(video.currentTime).toBe(12);
    expect(onTimeUpdate).toHaveBeenLastCalledWith(12);
    fireEvent.click(screen.getByRole('button', { name: 'Rewind to start' }));
    expect(video.currentTime).toBe(0);
  });

  it('keeps media speed, volume and captions connected to their controls', () => {
    const { container } = render(<VideoPlayer project={project} activeTrack="original" onChangeTrack={vi.fn()} />);
    const video = container.querySelector('video')!;
    fireEvent.change(screen.getByRole('combobox', { name: 'Playback speed' }), { target: { value: '1.5' } });
    expect(video.playbackRate).toBe(1.5);
    fireEvent.change(screen.getByRole('slider', { name: 'Volume' }), { target: { value: '0.4' } });
    expect(video.volume).toBe(0.4);
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(video.muted).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle subtitles' }));
    expect(screen.queryByText('Original caption')).not.toBeInTheDocument();
  });

  it('offers an accessible expanded preview when native fullscreen is unavailable', () => {
    render(<VideoPlayer project={project} activeTrack="original" onChangeTrack={vi.fn()} />);
    const expand = screen.getByRole('button', { name: 'Fullscreen' });
    expand.focus();
    fireEvent.click(expand);
    expect(screen.getByRole('dialog', { name: 'Video preview' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Close expanded preview' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fullscreen' })).toHaveFocus();
  });

  it('reports blocked playback without claiming the video is playing', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValueOnce(new Error('Playback blocked'));
    render(<VideoPlayer project={project} activeTrack="original" onChangeTrack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play video' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Playback could not start'));
    expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pause video' })).not.toBeInTheDocument();
  });
});
