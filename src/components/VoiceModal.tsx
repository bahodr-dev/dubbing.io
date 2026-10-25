import React, { useState, useEffect, useRef } from 'react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import type { Voice } from '../types';
import { VOICES } from '../data/voices';
import { Waveform } from './Waveform';
import { playVoiceSample, stopVoiceSample } from '../audio/audioSynth';

interface VoiceModalProps {
  isOpen: boolean;
  selectedVoiceId: string;
  onSelectVoice: (voice: Voice) => void;
  onClose: () => void;
  filterLanguageCode?: string;
  renderableVoiceIds?: string[] | null;
}

const VoiceModalContent: React.FC<VoiceModalProps> = ({
  isOpen,
  selectedVoiceId,
  onSelectVoice,
  onClose,
  filterLanguageCode,
  renderableVoiceIds,
}) => {
  const [activeTab, setActiveTab] = useState<string>(filterLanguageCode || 'all');
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ isOpen, dialogRef, onClose });

  useEffect(() => {
    return () => {
      stopVoiceSample();
    };
  }, []);

  if (!isOpen) return null;

  const filteredVoices = VOICES.filter(voice => {
    if (renderableVoiceIds && !renderableVoiceIds.includes(voice.id)) return false;
    const matchesLang = activeTab === 'all' || voice.languageCode === activeTab;
    const matchesSearch = voice.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          voice.language.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          voice.style.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLang && matchesSearch;
  });

  const handleTogglePlay = (voice: Voice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingVoiceId === voice.id) {
      stopVoiceSample();
      setPreviewingVoiceId(null);
    } else {
      setPreviewingVoiceId(voice.id);
      playVoiceSample(voice.name, {
        gender: voice.gender,
        languageCode: voice.languageCode,
        onEnd: () => setPreviewingVoiceId(null),
      });
    }
  };

  const handleSelect = (voice: Voice) => {
    stopVoiceSample();
    setPreviewingVoiceId(null);
    onSelectVoice(voice);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={() => { stopVoiceSample(); onClose(); }}>
      <div 
        className="modal-container" 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voice-dialog-title"
        tabIndex={-1}
        style={{ maxWidth: '680px' }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 id="voice-dialog-title" style={{ fontSize: '18px', fontWeight: 700 }}>Select Neural Voice</h3>
            <p style={{ fontSize: 'var(--text-body)', color: 'var(--black-60)', marginTop: '2px' }}>
              Studio-grade AI acoustic models with natural pacing and emotion
            </p>
          </div>
          <button 
            onClick={() => { stopVoiceSample(); onClose(); }} 
            aria-label="Close voice selection"
            className="btn-ghost" 
            style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px' }}
          >
            ✕
          </button>
        </div>

        {/* Filters & Search */}
        <div className="voice-modal-filters" style={{ padding: '16px 24px', borderBottom: 'var(--border-light)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              className="input"
              placeholder="Search voices by name or style..."
              aria-label="Search voices"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ fontSize: 'var(--text-input)', padding: '8px 12px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setActiveTab('all')}
              className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 10px' }}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('uz')}
              className={`btn btn-sm ${activeTab === 'uz' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 10px' }}
            >
              Uzbek
            </button>
            <button
              onClick={() => setActiveTab('en')}
              className={`btn btn-sm ${activeTab === 'en' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 10px' }}
            >
              English
            </button>
            <button
              onClick={() => setActiveTab('es')}
              className={`btn btn-sm ${activeTab === 'es' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 10px' }}
            >
              Spanish
            </button>
          </div>
        </div>

        {/* Voice List */}
        <div style={{ padding: '20px 24px', maxHeight: '460px', overflowY: 'auto' }}>
          {filteredVoices.length === 0 && <p role="status" style={{ textAlign: 'center', padding: '24px 0', color: 'var(--black-60)' }}>No voices match your search. Try another name or language.</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '14px' }}>
            {filteredVoices.map(voice => {
              const isSelected = voice.id === selectedVoiceId;
              const isPlaying = previewingVoiceId === voice.id;

              return (
                <div
                  key={voice.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${voice.name}`}
                  aria-pressed={isSelected}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      handleSelect(voice);
                    }
                  }}
                  onClick={() => handleSelect(voice)}
                  style={{
                    border: isSelected ? '2px solid var(--black-100)' : 'var(--border-light)',
                    backgroundColor: isSelected ? 'var(--black-02)' : 'var(--c-white)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                    position: 'relative',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.borderColor = 'var(--black-60)';
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.borderColor = 'var(--black-12)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 700 }}>{voice.name}</span>
                        {voice.recommended && (
                          <span style={{
                          fontSize: 'var(--text-meta)',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          backgroundColor: 'var(--black-100)',
                          color: 'var(--white-100)',
                          borderRadius: 'var(--radius-pill)',
                        }}>
                          HQ
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 'var(--text-meta)', color: 'var(--black-60)', marginTop: '2px' }}>
                      {voice.language} • {voice.style}
                    </div>
                  </div>

                  {isSelected && (
                    <span style={{
                      fontSize: 'var(--text-meta)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--black-100)',
                    }}>
                      Selected ✓
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 'var(--text-body)', color: 'var(--black-70)', marginBottom: '12px', lineHeight: 1.4 }}>
                  {voice.tone}
                </p>

                {/* Waveform graphic */}
                <div style={{
                  backgroundColor: 'var(--black-05)',
                  padding: '6px 10px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '12px',
                }}>
                  <Waveform
                    isPlaying={isPlaying}
                    barsCount={28}
                    height={24}
                    color="black"
                    seed={voice.name.charCodeAt(0) * 10}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={(e) => handleTogglePlay(voice, e)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      padding: '4px 10px',
                      fontSize: 'var(--text-control)',
                      fontWeight: 600,
                    }}
                  >
                    {isPlaying ? '■ Stop preview' : '▶ Play preview'}
                  </button>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    {voice.tags.slice(0, 2).map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: 'var(--text-meta)',
                          color: 'var(--black-60)',
                          border: '1px solid var(--black-12)',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-pill)',
                        }}
                      >
                        {tag}
                      </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button 
            onClick={() => { stopVoiceSample(); onClose(); }} 
            className="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export const VoiceModal: React.FC<VoiceModalProps> = (props) => (
  props.isOpen ? <VoiceModalContent key={props.filterLanguageCode || 'all'} {...props} /> : null
);
