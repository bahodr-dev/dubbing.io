import React, { useState, useEffect } from 'react';
import type { TranscriptSegment, Expression } from '../types';
import { Check, Edit3, Volume2, X, Search } from 'lucide-react';
import { playVoiceSample, stopVoiceSample } from '../audio/audioSynth';

interface TranscriptEditorProps {
  segments: TranscriptSegment[];
  onUpdateSegment: (segmentId: string, originalText: string, translatedText: string) => void;
  onSeekToTime?: (time: number) => void;
  targetLanguage: string;
  originalLanguage: string;
  currentPlayTime?: number;
  saveStatus?: 'saved' | 'saving' | 'error';
  onChangeMetadata?: (id: string, patch: Partial<TranscriptSegment>) => void;
  onRegenerate?: (id: string) => void;
  onRetryTranscription?: () => void | Promise<void>;
}

export const TranscriptEditor: React.FC<TranscriptEditorProps> = ({
  segments,
  onUpdateSegment,
  onSeekToTime,
  targetLanguage,
  originalLanguage,
  currentPlayTime,
  saveStatus = 'saved',
  onRetryTranscription,
  onChangeMetadata,
  onRegenerate,
}) => {
  const [activeTab, setActiveTab] = useState<'both' | 'translated' | 'original'>('both');
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [tempOriginal, setTempOriginal] = useState('');
  const [tempTranslated, setTempTranslated] = useState('');
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    return () => {
      stopVoiceSample();
    };
  }, []);

  const handleStartEdit = (seg: TranscriptSegment) => {
    setEditingSegmentId(seg.id);
    setTempOriginal(seg.originalText);
    setTempTranslated(seg.translatedText);
  };

  const handleCancelEdit = () => {
    setEditingSegmentId(null);
    setTempOriginal('');
    setTempTranslated('');
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
      stopVoiceSample();
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

  const filteredSegments = segments.filter(seg => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const orig = (seg.originalText || '').toLowerCase();
    const trans = (seg.translatedText || '').toLowerCase();
    const spk = (seg.speaker || '').toLowerCase();
    return orig.includes(q) || trans.includes(q) || spk.includes(q);
  });

  return (
    <div className="transcript-editor" style={{
      backgroundColor: 'var(--c-white)',
      border: 'var(--border-light)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
    }}>
      {/* Header Bar */}
      <div className="transcript-editor-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: 'var(--border-light)',
        backgroundColor: 'var(--black-02)',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h4 style={{ fontSize: '15px', fontWeight: 700 }}>Transcript & Dub Alignment</h4>
            {saveStatus === 'saving' && (
              <span style={{ fontSize: 'var(--text-meta)', color: 'var(--black-60)', fontStyle: 'italic' }}>Saving...</span>
            )}
            {saveStatus === 'error' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-meta)', color: 'var(--c-error, #e53e3e)', fontWeight: 600 }}>
                Transcript sync failed
                {onRetryTranscription && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={onRetryTranscription}>
                    Retry
                  </button>
                )}
              </span>
            )}
          </div>
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--black-60)', marginTop: '2px' }}>
            Inspect, edit, and fine-tune synchronized translation segments
          </p>
        </div>

        {/* View Segment Tabs */}
        <div className="transcript-view-toggle" role="group" aria-label="Transcript view" style={{
          display: 'flex',
          border: 'var(--border-light)',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          backgroundColor: 'var(--c-white)',
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('both')}
            aria-pressed={activeTab === 'both'}
            style={{
              padding: '6px 12px',
              fontSize: 'var(--text-control)',
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
            type="button"
            onClick={() => setActiveTab('translated')}
            aria-pressed={activeTab === 'translated'}
            style={{
              padding: '6px 12px',
              fontSize: 'var(--text-control)',
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
            type="button"
            onClick={() => setActiveTab('original')}
            aria-pressed={activeTab === 'original'}
            style={{
              padding: '6px 12px',
              fontSize: 'var(--text-control)',
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

      {/* Sub-header Search Bar */}
      <div className="transcript-editor-search" style={{
        padding: '10px 20px',
        borderBottom: 'var(--border-light)',
        backgroundColor: 'var(--c-white)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <Search size={14} style={{ color: 'var(--black-40)' }} />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search in transcript or speaker..."
          style={{
            border: 'none',
            outline: 'none',
            fontSize: 'var(--text-input)',
            width: '100%',
            backgroundColor: 'transparent',
            color: 'var(--black-100)',
          }}
          aria-label="Search transcript"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--black-40)', padding: '2px' }}
            aria-label="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Segments List */}
      <div className="transcript-segments" style={{ maxHeight: '520px', overflowY: 'auto' }}>
        {filteredSegments.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--black-40)', fontSize: 'var(--text-control)' }}>
            {segments.length === 0 ? 'No transcript yet. Generate a dub to create your transcript.' : 'No matching segments found. Try another search.'}
          </div>
        ) : filteredSegments.map((seg, idx) => {
          const isEditing = editingSegmentId === seg.id;
          const isPlaying = playingSegmentId === seg.id;
          const isCurrentActive = typeof currentPlayTime === 'number' && currentPlayTime >= seg.startTime && currentPlayTime <= seg.endTime;

          return (
            <div
              key={seg.id}
              style={{
                padding: '16px 20px',
                borderBottom: idx < segments.length - 1 ? 'var(--border-light)' : 'none',
                borderLeft: isCurrentActive ? '3px solid var(--black-100)' : '3px solid transparent',
                backgroundColor: isEditing 
                  ? 'var(--black-02)' 
                  : isCurrentActive 
                  ? 'rgba(0, 0, 0, 0.03)' 
                  : 'var(--c-white)',
                transition: 'all var(--transition-fast)',
              }}
            >
              {/* Row Header: Timestamp & Quick Action */}
              <div className="transcript-segment-header" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (onSeekToTime) onSeekToTime(seg.startTime);
                    }}
                    className="mono"
                    style={{
                      fontSize: 'var(--text-control)',
                      fontWeight: 600,
                      backgroundColor: isCurrentActive ? 'var(--black-100)' : 'var(--black-05)',
                      border: isCurrentActive ? '1px solid var(--black-100)' : 'var(--border-light)',
                      padding: '3px 10px',
                      borderRadius: 'var(--radius-pill)',
                      cursor: 'pointer',
                      color: isCurrentActive ? 'var(--white-100)' : 'var(--black-100)',
                      transition: 'all var(--transition-fast)',
                    }}
                    title="Seek video to this timestamp"
                  >
                    {formatTimestamp(seg.startTime)} - {formatTimestamp(seg.endTime)}
                  </button>

                  <span style={{ fontSize: 'var(--text-meta)', color: 'var(--black-40)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {seg.speaker || `Segment ${idx + 1}`}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handlePlaySegment(seg, seg.translatedText, targetLanguage)}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '4px 8px', fontSize: 'var(--text-control)' }}
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
                      style={{ padding: '4px 8px', fontSize: 'var(--text-control)' }}
                    >
                      <Edit3 size={12} />
                      Edit
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '4px 8px', fontSize: 'var(--text-control)' }}
                        title="Cancel"
                        aria-label="Cancel transcript edit"
                      >
                        <X size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(seg.id)}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '4px 10px', fontSize: 'var(--text-control)' }}
                      >
                        <Check size={12} />
                        Save
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {onChangeMetadata && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <label>Speaker <input aria-label={`Speaker for ${seg.id}`} disabled={saveStatus === 'saving'} defaultValue={seg.speaker || ''} onBlur={e => { if (e.target.value !== seg.speaker) onChangeMetadata(seg.id, { speaker: e.target.value }); }} /></label>
                <label>Expression <select aria-label={`Expression for ${seg.id}`} disabled={saveStatus === 'saving'} value={seg.expression || 'neutral'} onChange={e => onChangeMetadata(seg.id, { expression: e.target.value as Expression, expressionEdited: true })}>
                  {['neutral', 'whisper', 'shout', 'sad', 'happy'].map(value => <option key={value}>{value}</option>)}
                </select></label>
                {onRegenerate && <button type="button" className="btn btn-secondary btn-sm" disabled={saveStatus !== 'saved'} onClick={() => onRegenerate(seg.id)}>Regenerate segment</button>}
                {seg.qualityWarnings?.length ? <p role="status">Review: {seg.qualityWarnings.join(', ')}</p> : null}
                {seg.regenerationStatus === 'pending' && <p>Audio needs regeneration.</p>}
                {seg.regenerationStatus === 'needs_edit' && <p>Shorten this translation before regenerating.</p>}
              </div>}
              {/* Segment Content */}
              {isEditing ? (
                <div className="transcript-segment-content" style={{ display: 'grid', gridTemplateColumns: activeTab === 'both' ? '1fr 1fr' : '1fr', gap: '12px' }}>
                  {(activeTab === 'both' || activeTab === 'original') && (
                    <div>
                      <label htmlFor={`segment-original-${seg.id}`} className="label" style={{ fontSize: 'var(--text-control)' }}>Original ({originalLanguage.toUpperCase()})</label>
                      <textarea
                        id={`segment-original-${seg.id}`}
                        className="textarea"
                        rows={2}
                        value={tempOriginal}
                        onChange={e => setTempOriginal(e.target.value)}
                        onKeyDown={e => {
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            handleSaveEdit(seg.id);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        style={{ fontSize: 'var(--text-input)', lineHeight: 1.4 }}
                      />
                    </div>
                  )}
                  {(activeTab === 'both' || activeTab === 'translated') && (
                    <div>
                      <label htmlFor={`segment-translated-${seg.id}`} className="label" style={{ fontSize: 'var(--text-control)' }}>Translated ({targetLanguage.toUpperCase()})</label>
                      <textarea
                        id={`segment-translated-${seg.id}`}
                        className="textarea"
                        rows={2}
                        value={tempTranslated}
                        onChange={e => setTempTranslated(e.target.value)}
                        onKeyDown={e => {
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            handleSaveEdit(seg.id);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        style={{ fontSize: 'var(--text-input)', lineHeight: 1.4, fontWeight: 500 }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="transcript-segment-content" style={{ display: 'grid', gridTemplateColumns: activeTab === 'both' ? '1fr 1fr' : '1fr', gap: '20px' }}>
                  {(activeTab === 'both' || activeTab === 'original') && (
                    <div>
                      {activeTab === 'both' && (
                        <div style={{ fontSize: 'var(--text-meta)', color: 'var(--black-40)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Original ({originalLanguage.toUpperCase()})
                        </div>
                      )}
                      <p style={{ fontSize: 'var(--text-body)', color: 'var(--black-70)', lineHeight: 1.5 }}>
                        {seg.originalText}
                      </p>
                    </div>
                  )}

                  {(activeTab === 'both' || activeTab === 'translated') && (
                    <div>
                      {activeTab === 'both' && (
                        <div style={{ fontSize: 'var(--text-meta)', color: 'var(--black-100)', fontWeight: 600, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Dubbed ({targetLanguage.toUpperCase()})
                        </div>
                      )}
                      <p style={{ fontSize: 'var(--text-body)', color: 'var(--black-100)', fontWeight: 500, lineHeight: 1.5 }}>
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
