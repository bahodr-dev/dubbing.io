import React, { useState } from 'react';
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
}

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  selectedVoiceId,
  onSelectVoice,
  onClose,
  filterLanguageCode,
}) => {
  const [activeTab, setActiveTab] = useState<string>(filterLanguageCode || 'all');
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredVoices = VOICES.filter(voice => {
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
        style={{ maxWidth: '680px' }} 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Select Neural Voice</h3>
            <p style={{ fontSize: '13px', color: 'var(--black-60)', marginTop: '2px' }}>
              Studio-grade AI acoustic models with natural pacing and emotion
            </p>
          </div>
          <button 
            onClick={() => { stopVoiceSample(); onClose(); }} 
            className="btn-ghost" 
            style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px' }}
          >
            ✕
          </button>
        </div>

        {/* Filters & Search */}
        <div style={{ padding: '16px 24px', borderBottom: 'var(--border-light)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <input
              type="text"
              className="input"
              placeholder="Search voices by name or style..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ fontSize: '13px', padding: '8px 12px' }}
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {filteredVoices.map(voice => {
              const isSelected = voice.id === selectedVoiceId;
              const isPlaying = previewingVoiceId === voice.id;

              return (
                <div
                  key={voice.id}
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
                            fontSize: '10px',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            padding: '1px 6px',
                            backgroundColor: 'var(--black-100)',
                            color: 'var(--white-100)',
                            borderRadius: '2px',
                          }}>
                            HQ
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--black-60)', marginTop: '2px' }}>
                        {voice.language} • {voice.style}
                      </div>
                    </div>

                    {isSelected && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--black-100)',
                      }}>
                        Selected ✓
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--black-70)', marginBottom: '12px', lineHeight: 1.4 }}>
                    {voice.tone}
                  </p>

                  {/* Waveform graphic */}
                  <div style={{
                    backgroundColor: 'var(--black-05)',
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-xs)',
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
                        fontSize: '12px',
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
                            fontSize: '10px',
                            color: 'var(--black-60)',
                            border: '1px solid var(--black-12)',
                            padding: '2px 5px',
                            borderRadius: '2px',
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
