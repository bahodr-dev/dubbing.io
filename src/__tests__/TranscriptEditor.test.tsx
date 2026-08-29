import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TranscriptEditor } from '../components/TranscriptEditor';
import type { TranscriptSegment } from '../types';

describe('TranscriptEditor Component', () => {
  const mockSegments: TranscriptSegment[] = [
    {
      id: 'seg-1',
      startTime: 0,
      endTime: 4.5,
      originalText: 'Welcome to the future of AI media localization.',
      translatedText: 'Sunʼiy intellekt media mahalliylashtirish kelajagiga xush kelibsiz.',
      speaker: 'Speaker 01',
    },
    {
      id: 'seg-2',
      startTime: 4.5,
      endTime: 9.0,
      originalText: 'We translate and clone voices in real-time.',
      translatedText: 'Biz ovozlarni real vaqt rejimida tarjima qilamiz va klonlaymiz.',
      speaker: 'Speaker 02',
    },
  ];

  it('renders transcript segments with timestamps and speaker names', () => {
    render(
      <TranscriptEditor
        segments={mockSegments}
        onUpdateSegment={vi.fn()}
        targetLanguage="uz"
        originalLanguage="en"
      />
    );

    expect(screen.getByText(/Welcome to the future of AI media localization/i)).toBeInTheDocument();
    expect(screen.getByText(/Sunʼiy intellekt media mahalliylashtirish kelajagiga xush kelibsiz/i)).toBeInTheDocument();
    expect(screen.getByText(/Speaker 01/i)).toBeInTheDocument();
    expect(screen.getByText(/Speaker 02/i)).toBeInTheDocument();
    expect(screen.getByText('00:00 - 00:04')).toBeInTheDocument();
  });

  it('filters segments when searching by keyword or speaker', () => {
    render(
      <TranscriptEditor
        segments={mockSegments}
        onUpdateSegment={vi.fn()}
        targetLanguage="uz"
        originalLanguage="en"
      />
    );

    const searchInput = screen.getByLabelText('Search transcript');
    fireEvent.change(searchInput, { target: { value: 'Speaker 02' } });

    expect(screen.queryByText(/Welcome to the future/i)).not.toBeInTheDocument();
    expect(screen.getByText(/We translate and clone voices/i)).toBeInTheDocument();
  });

  it('triggers onSeekToTime when timestamp button is clicked', () => {
    const handleSeek = vi.fn();
    render(
      <TranscriptEditor
        segments={mockSegments}
        onUpdateSegment={vi.fn()}
        onSeekToTime={handleSeek}
        targetLanguage="uz"
        originalLanguage="en"
      />
    );

    const timeButton = screen.getByText('00:00 - 00:04');
    fireEvent.click(timeButton);

    expect(handleSeek).toHaveBeenCalledWith(0);
  });

  it('supports editing and saving segment text', () => {
    const handleUpdate = vi.fn();
    render(
      <TranscriptEditor
        segments={mockSegments}
        onUpdateSegment={handleUpdate}
        targetLanguage="uz"
        originalLanguage="en"
      />
    );

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    const textareas = screen.getAllByRole('textbox');
    // Change translated text
    fireEvent.change(textareas[textareas.length - 1], {
      target: { value: 'Yangi tarjima matni.' },
    });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    expect(handleUpdate).toHaveBeenCalledWith(
      'seg-1',
      'Welcome to the future of AI media localization.',
      'Yangi tarjima matni.'
    );
  });
});
