import React, { useState } from 'react';
import type { TranscriptSegment } from '../types';
import { Check, Edit3, Volume2 } from 'lucide-react';
import { playVoiceSample, stopVoiceSample } from '../audio/audioSynth';

interface TranscriptEditorProps {
  segments: TranscriptSegment[];
  onUpdateSegment: (segmentId: string, originalText: string, translatedText: string) => void;
  onSeekToTime?: (time: number) => void;
  targetLanguage: string;
  originalLanguage: string;
}

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  segments,
  onUpdateSegment,
  onSeekToTime,
  targetLanguage,
  originalLanguage,
}) => {
  const [activeTab, setActiveTab] = useState<'both' | 'translated' | 'original'>('both');
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [tempOriginal, setTempOriginal] = useState('');
  const [tempTranslated, setTempTranslated] = useState('');
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);

  const handleStartEdit = (seg: TranscriptSegment) => {
    setEditingSegmentId(seg.id);
    setTempOriginal(seg.originalText);
    setTempTranslated(seg.translatedText);
  };

  const handleSaveEdit = (segId: string) => {
    onUpdateSegment(segId, tempOriginal, tempTranslated);
    setEditingSegmentId(null);
  };

  const handlePlaySegment = (seg: TranscriptSegment, text: string, lang: string) => {
    if (playingSegmentId === seg.id) {
      stopVoiceSample();
      setPlayingSegmentId(null);
    } else {
      setPlayingSegmentId(seg.id);
      if (onSeekToTime) onSeekToTime(seg.startTime);
      playVoiceSample(lang === 'uz' ? 'Farrux' : 'Sophia', {
        gender: lang === 'uz' ? 'male' : 'female',
        languageCode: lang,
        sampleText: text,
        onEnd: () => setPlayingSegmentId(null),
      });
    }
  };

  function formatTimestamp(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div style={{
      backgroundColor: 'var(--c-white)',
      border: 'var(--border-light)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: 'var(--border-light)',
        backgroundColor: 'var(--black-02)',
      }}>
        <div>
          <h4 style={{ fontSize: '15px', fontWeight: 700 }}>Transcript & Dub Alignment</h4>
          <p style={{ fontSize: '12px', color: 'var(--black-60)', marginTop: '2px' }}>
            Inspect, edit, and fine-tune synchronized translation segments
          </p>
        </div>

        {/* View Segment Tabs */}
        <div style={{
          display: 'flex',
          border: 'var(--border-light)',
          borderRadius: 'var(--radius-xs)',
          overflow: 'hidden',
          backgroundColor: 'var(--c-white)',
        }}>
          <button
            onClick={() => setActiveTab('both')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              background: activeTab === 'both' ? 'var(--black-100)' : 'transparent',
              color: activeTab === 'both' ? 'var(--white-100)' : 'var(--black-60)',
              cursor: 'pointer',
            }}
          >
            Split View
          </button>
          <button
            onClick={() => setActiveTab('translated')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              borderLeft: 'var(--border-light)',
              background: activeTab === 'translated' ? 'var(--black-100)' : 'transparent',
              color: activeTab === 'translated' ? 'var(--white-100)' : 'var(--black-60)',
              cursor: 'pointer',
            }}
          >
            Translated ({targetLanguage.toUpperCase()})
          </button>
          <button
            onClick={() => setActiveTab('original')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              borderLeft: 'var(--border-light)',
              background: activeTab === 'original' ? 'var(--black-100)' : 'transparent',
              color: activeTab === 'original' ? 'var(--white-100)' : 'var(--black-60)',
              cursor: 'pointer',
            }}
          >
            Original ({originalLanguage.toUpperCase()})
          </button>
        </div>
      </div>

      {/* Segments List */}
      <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
        {segments.map((seg, idx) => {
          const isEditing = editingSegmentId === seg.id;
          const isPlaying = playingSegmentId === seg.id;

          return (
            <div
              key={seg.id}
              style={{
                padding: '16px 20px',
                borderBottom: idx < segments.length - 1 ? 'var(--border-light)' : 'none',
                backgroundColor: isEditing ? 'var(--black-02)' : 'var(--c-white)',
                transition: 'background-color var(--transition-fast)',
              }}
            >
              {/* Row Header: Timestamp & Quick Action */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => {
                      if (onSeekToTime) onSeekToTime(seg.startTime);
                    }}
                    className="mono"
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: 'var(--black-05)',
                      border: 'var(--border-light)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-xs)',
                      cursor: 'pointer',
                      color: 'var(--black-100)',
                    }}
                    title="Seek video to this timestamp"
                  >
                    {formatTimestamp(seg.startTime)} - {formatTimestamp(seg.endTime)}
                  </button>

                  <span style={{ fontSize: '11px', color: 'var(--black-40)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {seg.speaker || `Segment ${idx + 1}`}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handlePlaySegment(seg, seg.translatedText, targetLanguage)}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 8px', fontSize: '11px' }}
                    title="Listen to translated speech"
                  >
                    <Volume2 size={13} />
                    {isPlaying ? 'Playing...' : 'Audition'}
                  </button>

                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => handleStartEdit(seg)}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      <Edit3 size={12} />
                      Edit
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(seg.id)}
                      className="btn btn-primary btn-sm"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                    >
                      <Check size={12} />
                      Save
                    </button>
                  )}
                </div>
              </div>

              {/* Segment Content Content */}
              {isEditing ? (
                <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'both' ? '1fr 1fr' : '1fr', gap: '12px' }}>
                  {(activeTab === 'both' || activeTab === 'original') && (
                    <div>
                      <label className="label" style={{ fontSize: '10px' }}>Original ({originalLanguage.toUpperCase()})</label>
                      <textarea
                        className="textarea"
                        rows={2}
                        value={tempOriginal}
                        onChange={e => setTempOriginal(e.target.value)}
                        style={{ fontSize: '13px', lineHeight: 1.4 }}
                      />
                    </div>
                  )}
                  {(activeTab === 'both' || activeTab === 'translated') && (
                    <div>
                      <label className="label" style={{ fontSize: '10px' }}>Translated ({targetLanguage.toUpperCase()})</label>
                      <textarea
                        className="textarea"
                        rows={2}
                        value={tempTranslated}
                        onChange={e => setTempTranslated(e.target.value)}
                        style={{ fontSize: '13px', lineHeight: 1.4, fontWeight: 500 }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: activeTab === 'both' ? '1fr 1fr' : '1fr', gap: '20px' }}>
                  {(activeTab === 'both' || activeTab === 'original') && (
                    <div>
                      {activeTab === 'both' && (
                        <div style={{ fontSize: '11px', color: 'var(--black-40)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Original ({originalLanguage.toUpperCase()})
                        </div>
                      )}
                      <p style={{ fontSize: '13.5px', color: 'var(--black-70)', lineHeight: 1.5 }}>
                        {seg.originalText}
                      </p>
                    </div>
                  )}

                  {(activeTab === 'both' || activeTab === 'translated') && (
                    <div>
                      {activeTab === 'both' && (
                        <div style={{ fontSize: '11px', color: 'var(--black-100)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Dubbed ({targetLanguage.toUpperCase()})
                        </div>
                      )}
                      <p style={{ fontSize: '14px', color: 'var(--black-100)', fontWeight: 500, lineHeight: 1.5 }}>
                        {seg.translatedText}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
