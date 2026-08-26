import React, { useState } from 'react';
import { Sparkles, ArrowRight, Play, Volume2 } from 'lucide-react';
import { Waveform } from '../components/Waveform';
import { playVoiceSample, stopVoiceSample } from '../audio/audioSynth';

interface LandingViewProps {
  onStartDubbing: () => void;
  onOpenPricing: () => void;
  onOpenSignIn: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({
  onStartDubbing,
  onOpenPricing,
}) => {
  const [demoLang, setDemoLang] = useState<'uz' | 'es' | 'ja' | 'de'>('uz');
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const [demoTrack, setDemoTrack] = useState<'original' | 'dubbed'>('dubbed');

  const demoPhrases = {
    en: "Welcome everyone. Today we are introducing real-time AI video dubbing with natural emotion.",
    uz: "Assalomu alaykum barchaga. Bugun biz tabiiy his-tuyg'ularga ega real vaqtdagi sun'iy intellekt dublyajini taqdim etamiz.",
    es: "Bienvenidos a todos. Hoy presentamos el doblaje de video con IA en tiempo real y emoción natural.",
    ja: "皆様ようこそ。本日は自然な感情表現を備えたリアルタイムAIビデオ吹き替えをご紹介します。",
    de: "Willkommen an alle. Heute stellen wir Echtzeit-KI-Videosynchronisation mit natürlichen Emotionen vor.",
  };

  const handlePlayDemo = (track: 'original' | 'dubbed', lang: 'uz' | 'es' | 'ja' | 'de') => {
    if (isPlayingDemo && demoTrack === track) {
      stopVoiceSample();
      setIsPlayingDemo(false);
    } else {
      setIsPlayingDemo(true);
      setDemoTrack(track);
      const text = track === 'dubbed' ? demoPhrases[lang] : demoPhrases.en;
      const voiceName = lang === 'uz' ? 'Farrux' : lang === 'es' ? 'Elena' : lang === 'ja' ? 'Kenji' : 'Marcus';

      playVoiceSample(track === 'dubbed' ? voiceName : 'Sophia', {
        gender: lang === 'es' ? 'female' : 'male',
        languageCode: track === 'dubbed' ? lang : 'en',
        sampleText: text,
        onEnd: () => setIsPlayingDemo(false),
      });
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--c-white)' }}>
      {/* 1. Hero Section */}
      <section style={{
        padding: '110px 0 80px',
        textAlign: 'center',
        position: 'relative',
      }}>
        <div className="container-lg">
          {/* Subtle Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 14px',
            border: '1px solid var(--black-12)',
            borderRadius: 'var(--radius-xs)',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '28px',
            backgroundColor: 'var(--black-02)',
          }}>
            <span style={{ width: '6px', height: '6px', backgroundColor: 'var(--black-100)', borderRadius: '50%' }} />
            Next-Gen Neural Voice Architecture
          </div>

          {/* Large, Confident Headline */}
          <h1 style={{
            fontSize: 'clamp(44px, 7vw, 82px)',
            fontWeight: 800,
            letterSpacing: '-0.045em',
            lineHeight: 1.02,
            marginBottom: '28px',
            color: 'var(--black-100)',
          }}>
            Your video.<br />Every language.
          </h1>

          {/* Subhead */}
          <p style={{
            fontSize: 'clamp(17px, 2.2vw, 21px)',
            color: 'var(--black-60)',
            maxWidth: '560px',
            margin: '0 auto 36px',
            lineHeight: 1.45,
            fontWeight: 400,
          }}>
            AI-powered video translation and dubbing. Upload your video, choose a language, and generate studio-quality dubbed voices in seconds.
          </p>

          {/* Primary Action Group */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            marginBottom: '64px',
          }}>
            <button
              onClick={onStartDubbing}
              className="btn btn-primary btn-lg"
              style={{
                padding: '14px 32px',
                fontSize: '16px',
                fontWeight: 600,
              }}
            >
              Start dubbing →
            </button>
            <button
              onClick={onOpenPricing}
              className="btn btn-secondary btn-lg"
              style={{
                padding: '14px 28px',
                fontSize: '16px',
                fontWeight: 500,
              }}
            >
              View pricing
            </button>
          </div>

          {/* Interactive Video Demonstration Comparison Box */}
          <div style={{
            maxWidth: '920px',
            margin: '0 auto',
            border: '1px solid var(--black-20)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            backgroundColor: 'var(--black-100)',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.08)',
          }}>
            {/* Demo Bar Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              backgroundColor: '#0a0a0a',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="mono" style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>
                  LIVE COMPARISON STUDIO
                </span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  padding: '2px 6px',
                  borderRadius: '2px',
                }}>
                  INTERACTIVE
                </span>
              </div>

              {/* Language Switcher Buttons */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {[
                  { code: 'uz', label: "Uzbek (O'zbek)" },
                  { code: 'es', label: 'Spanish' },
                  { code: 'ja', label: 'Japanese' },
                  { code: 'de', label: 'German' },
                ].map(item => (
                  <button
                    key={item.code}
                    onClick={() => {
                      setDemoLang(item.code as any);
                      stopVoiceSample();
                      setIsPlayingDemo(false);
                    }}
                    style={{
                      background: demoLang === item.code ? '#ffffff' : 'rgba(255, 255, 255, 0.08)',
                      color: demoLang === item.code ? '#000000' : 'rgba(255, 255, 255, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      fontSize: '12px',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-xs)',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Split Comparison Demonstration Area */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
            }}>
              {/* Left Column: Original English */}
              <div style={{
                padding: '32px 28px',
                borderRight: '1px solid rgba(255, 255, 255, 0.1)',
                textAlign: 'left',
                backgroundColor: '#050505',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <span className="mono" style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' }}>
                      Source Video
                    </span>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                      Original: English
                    </h3>
                  </div>
                  <button
                    onClick={() => handlePlayDemo('original', demoLang)}
                    className="btn btn-secondary btn-sm"
                    style={{
                      backgroundColor: demoTrack === 'original' && isPlayingDemo ? '#ffffff' : 'transparent',
                      color: demoTrack === 'original' && isPlayingDemo ? '#000000' : '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      padding: '6px 12px',
                    }}
                  >
                    {demoTrack === 'original' && isPlayingDemo ? <Volume2 size={13} /> : <Play size={13} />}
                    {demoTrack === 'original' && isPlayingDemo ? 'Playing' : 'Listen original'}
                  </button>
                </div>

                <div style={{
                  padding: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '20px',
                }}>
                  <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.5 }}>
                    "{demoPhrases.en}"
                  </p>
                </div>

                <Waveform
                  isPlaying={demoTrack === 'original' && isPlayingDemo}
                  barsCount={32}
                  height={30}
                  color="white"
                  seed={24}
                />
              </div>

              {/* Right Column: Dubbed Uzbek / Target */}
              <div style={{
                padding: '32px 28px',
                textAlign: 'left',
                backgroundColor: '#0a0a0a',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="mono" style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', textTransform: 'uppercase' }}>
                        Synthesized Dub
                      </span>
                      <Sparkles size={12} color="#ffffff" />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', marginTop: '2px' }}>
                      Dubbed: {demoLang === 'uz' ? "Uzbek (Farrux)" : demoLang === 'es' ? "Spanish (Elena)" : demoLang === 'ja' ? "Japanese (Kenji)" : "German (Marcus)"}
                    </h3>
                  </div>
                  <button
                    onClick={() => handlePlayDemo('dubbed', demoLang)}
                    className="btn btn-white btn-sm"
                    style={{
                      padding: '6px 14px',
                      fontWeight: 600,
                    }}
                  >
                    {demoTrack === 'dubbed' && isPlayingDemo ? <Volume2 size={13} /> : <Play size={13} />}
                    {demoTrack === 'dubbed' && isPlayingDemo ? 'Playing dub' : 'Play dubbed AI'}
                  </button>
                </div>

                <div style={{
                  padding: '16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '20px',
                }}>
                  <p style={{ fontSize: '14px', color: '#ffffff', fontWeight: 500, lineHeight: 1.5 }}>
                    "{demoPhrases[demoLang]}"
                  </p>
                </div>

                <Waveform
                  isPlaying={demoTrack === 'dubbed' && isPlayingDemo}
                  barsCount={32}
                  height={30}
                  color="white"
                  seed={88}
                />
              </div>
            </div>

            {/* Bottom Demo Bar Action */}
            <div style={{
              padding: '14px 20px',
              backgroundColor: '#000000',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)' }}>
                Lip-sync preserved • Zero cadence distortion • 44.1 kHz neural output
              </span>
              <button
                onClick={onStartDubbing}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Try with your own video <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. How It Works (Editorial 4-Step Grid) */}
      <section id="how-it-works" style={{
        padding: '90px 0',
        borderTop: 'var(--border-light)',
        backgroundColor: 'var(--c-white)',
      }}>
        <div className="container-xl">
          <div style={{ marginBottom: '56px' }}>
            <span className="mono" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--black-40)' }}>
              01 / WORKFLOW
            </span>
            <h2 style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-0.04em', marginTop: '6px' }}>
              How it works
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--black-60)', marginTop: '4px' }}>
              Simple, transparent, four-step transformation.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            borderTop: 'var(--border-light)',
            borderLeft: 'var(--border-light)',
          }}>
            {[
              {
                number: '01',
                title: 'Upload your video',
                description: 'Drag & drop any MP4 or MOV file up to 30 seconds or paste a direct video link.',
              },
              {
                number: '02',
                title: 'Choose a language',
                description: 'Select from over 40 target languages including Uzbek, Spanish, Japanese, and German.',
              },
              {
                number: '03',
                title: 'Select a voice',
                description: 'Pick an AI voice tailored for natural cadence, professional authority, or warm narrative tone.',
              },
              {
                number: '04',
                title: 'Generate your dub',
                description: 'Export studio-mastered video with synchronized audio tracks and full transcript control.',
              },
            ].map((step, idx) => (
              <div
                key={idx}
                style={{
                  padding: '36px 28px',
                  borderRight: 'var(--border-light)',
                  borderBottom: 'var(--border-light)',
                  backgroundColor: 'var(--c-white)',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--black-02)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--c-white)'}
              >
                <div className="mono" style={{ fontSize: '32px', fontWeight: 800, color: 'var(--black-20)', marginBottom: '16px' }}>
                  {step.number}
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '10px', color: 'var(--black-100)' }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--black-60)', lineHeight: 1.55 }}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Features (Minimal Architectural Grid) */}
      <section style={{
        padding: '90px 0',
        borderTop: 'var(--border-light)',
        backgroundColor: 'var(--black-02)',
      }}>
        <div className="container-xl">
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '56px' }}>
            <div>
              <span className="mono" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--black-40)' }}>
                02 / CAPABILITIES
              </span>
              <h2 style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-0.04em', marginTop: '6px' }}>
                Engineered for clarity.
              </h2>
            </div>
            <p style={{ fontSize: '14px', color: 'var(--black-60)', maxWidth: '380px', textAlign: 'right' }}>
              Built for high-velocity creators and global enterprises requiring broadcast fidelity.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '20px',
          }}>
            {[
              {
                tag: 'ACCURACY',
                title: 'AI Video Translation',
                desc: 'Context-aware translation that adapts idioms, terminology, and timing to match natural conversational cadence.',
              },
              {
                tag: 'ACOUSTICS',
                title: 'Natural AI Voices',
                desc: 'Trained on high-end acoustic models that reproduce human breath, pitch dynamics, and subtle emotional weight.',
              },
              {
                tag: 'GLOBAL REACH',
                title: '40+ Supported Languages',
                desc: 'Native support for Uzbek, English, Spanish, German, French, Japanese, Arabic, and more with localized accents.',
              },
              {
                tag: 'SPEED',
                title: 'Ultra-Fast Processing',
                desc: 'Multi-stage parallel pipeline transcribes, translates, and generates studio audio in under 60 seconds.',
              },
              {
                tag: 'EDITING',
                title: 'Transcript & Timing Alignment',
                desc: 'Inspect and edit every subtitle and word inline before final video muxing and rendering.',
              },
              {
                tag: 'EXPORT',
                title: 'Studio Quality Export',
                desc: 'Download 1080p/4K master MP4 files, isolated WAV stems, or synchronized SRT/VTT subtitle packages.',
              },
            ].map((feat, idx) => (
              <div
                key={idx}
                className="card"
                style={{
                  padding: '28px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div className="mono" style={{ fontSize: '11px', color: 'var(--black-40)', marginBottom: '12px', letterSpacing: '0.05em' }}>
                  {feat.tag}
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>
                  {feat.title}
                </h3>
                <p style={{ fontSize: '13.5px', color: 'var(--black-60)', lineHeight: 1.55 }}>
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Final Editorial CTA */}
      <section style={{
        padding: '110px 0',
        borderTop: 'var(--border-light)',
        backgroundColor: 'var(--black-100)',
        color: 'var(--white-100)',
        textAlign: 'center',
      }}>
        <div className="container-md">
          <h2 style={{
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1.1,
            marginBottom: '20px',
            color: 'var(--white-100)',
          }}>
            Ready to speak every language?
          </h2>
          <p style={{
            fontSize: '17px',
            color: 'var(--white-70)',
            marginBottom: '36px',
            lineHeight: 1.5,
          }}>
            Join global creators and modern teams breaking language barriers with dubbing.io.
          </p>
          <button
            onClick={onStartDubbing}
            className="btn btn-white btn-lg"
            style={{
              padding: '16px 36px',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            Start dubbing →
          </button>
        </div>
      </section>
    </div>
  );
};
