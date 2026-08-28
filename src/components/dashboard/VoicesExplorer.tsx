import React, { useState } from 'react';
import type { Voice } from '../../types';
import { playVoiceSample, stopVoiceSample } from '../../audio/audioSynth';
import { Volume2, Pause, Sparkles } from 'lucide-react';

interface VoicesExplorerProps {
  voices: Voice[];
  onOpenNewDub: () => void;
}

export const VoicesExplorer: React.FC<VoicesExplorerProps> = ({ voices, onOpenNewDub }) => {
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<'all' | 'female' | 'male'>('all');
  const [selectedLang, setSelectedLang] = useState<string>('all');

  const handlePlayVoice = (
    voiceId: string,
    voiceName: string,
    langCode: string,
    gender: 'female' | 'male' | 'neutral'
  ) => {
    if (playingVoiceId === voiceId) {
      stopVoiceSample();
      setPlayingVoiceId(null);
    } else {
      stopVoiceSample();
      setPlayingVoiceId(voiceId);
      const isUzbek = langCode === 'uz';
      playVoiceSample(voiceName, {
        gender,
        languageCode: langCode,
        sampleText: isUzbek
          ? `Salom! Men ${voiceName}man. Dubbing nuqta io orqali istalgan videongizni tabiiy va professional ovozda tarjima qiling.`
          : `Hello! I am ${voiceName}. Transform your videos into high-quality studio voices with Dubbing dot io.`,
        onEnd: () => setPlayingVoiceId(null),
      });
    }
  };

  const filteredVoices = voices.filter((v) => {
    const matchGender = selectedGender === 'all' || v.gender === selectedGender;
    const matchLang = selectedLang === 'all' || v.languageCode === selectedLang;
    return matchGender && matchLang;
  });

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', animation: 'fadeIn 180ms ease' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Neural Voice Library
          </h1>
          <p style={{ fontSize: '13.5px', color: 'rgba(0, 0, 0, 0.55)', marginTop: '3px' }}>
            Audition studio-grade neural voice models or clone custom acoustic profiles
          </p>
        </div>

        <button
          onClick={onOpenNewDub}
          className="btn btn-primary"
          style={{
            padding: '9px 18px',
            fontWeight: 600,
            fontSize: '13.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sparkles size={15} />
          <span>Dub with Voice</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all', 'female', 'male'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setSelectedGender(g)}
              className="badge"
              style={{
                border: 'none',
                backgroundColor: selectedGender === g ? 'var(--black-100)' : 'transparent',
                color: selectedGender === g ? 'var(--white-100)' : 'var(--black-60)',
                cursor: 'pointer',
                textTransform: 'capitalize',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: selectedGender === g ? 600 : 500,
              }}
            >
              {g === 'all' ? 'All Genders' : g}
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '20px', backgroundColor: 'rgba(0, 0, 0, 0.1)' }} />

        <div style={{ display: 'flex', gap: '4px' }}>
          {[
            { code: 'all', label: 'All Languages' },
            { code: 'uz', label: 'Uzbek (O\'zbek)' },
            { code: 'en', label: 'English' },
            { code: 'es', label: 'Spanish' },
          ].map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setSelectedLang(l.code)}
              className="badge"
              style={{
                border: 'none',
                backgroundColor: selectedLang === l.code ? 'var(--black-100)' : 'transparent',
                color: selectedLang === l.code ? 'var(--white-100)' : 'var(--black-60)',
                cursor: 'pointer',
                padding: '6px 14px',
                fontSize: '12.5px',
                fontWeight: selectedLang === l.code ? 600 : 500,
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Voices Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '16px',
        }}
      >
        {filteredVoices.map((voice) => {
          const isPlaying = playingVoiceId === voice.id;

          return (
            <div
              key={voice.id}
              className="card"
              style={{
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: isPlaying ? '1px solid #000000' : '1px solid rgba(0, 0, 0, 0.08)',
                boxShadow: isPlaying ? '0 4px 16px rgba(0, 0, 0, 0.06)' : 'none',
                transition: 'all 140ms ease',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--black-05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '14px',
                      }}
                    >
                      {voice.name.charAt(0)}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                        {voice.name}
                      </h3>
                      <span style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.5)' }}>
                        {voice.language} • {voice.gender}
                      </span>
                    </div>
                  </div>

                  {/* Audition / Preview Button */}
                  <button
                    type="button"
                    onClick={() =>
                      handlePlayVoice(voice.id, voice.name, voice.languageCode, voice.gender)
                    }
                    className="btn btn-sm"
                    style={{
                      borderRadius: '50%',
                      width: '36px',
                      height: '36px',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isPlaying ? '#000000' : 'var(--black-05)',
                      color: isPlaying ? '#ffffff' : '#000000',
                      border: 'none',
                    }}
                    title={isPlaying ? 'Stop preview' : 'Play voice sample'}
                  >
                    {isPlaying ? <Pause size={15} /> : <Volume2 size={15} />}
                  </button>
                </div>

                <p
                  style={{
                    fontSize: '12.5px',
                    color: 'rgba(0, 0, 0, 0.65)',
                    lineHeight: 1.4,
                    marginBottom: '12px',
                  }}
                >
                  {voice.tone}
                </p>
              </div>

              {/* Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    color: 'rgba(0, 0, 0, 0.7)',
                  }}
                >
                  {voice.style}
                </span>
                {voice.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(0, 0, 0, 0.03)',
                      color: 'rgba(0, 0, 0, 0.55)',
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
