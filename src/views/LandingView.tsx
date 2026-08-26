import React, { useState } from 'react';
import { Sparkles, Play, Volume2 } from 'lucide-react';
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
      {/* 1. Hero Content */}
      <section style={{
        paddingTop: '120px',
        textAlign: 'center',
        position: 'relative',
      }}>
        <div className="container-lg">
          {/* Step 1: Technical Label */}
          <div className="hero-stagger-1" style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              border: 'var(--border-light)',
              borderRadius: 'var(--radius-xs)',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              backgroundColor: 'var(--black-02)',
              color: 'var(--black-80)',
            }}>
              <span className="animate-pulse-dot" style={{ width: '5px', height: '5px', backgroundColor: 'var(--black-100)', borderRadius: '50%' }} />
              Next-Gen Neural Voice Architecture
            </div>
          </div>

          {/* Step 2: Large, Architectural Display Headline */}
          <div className="hero-stagger-2" style={{ marginBottom: '24px' }}>
            <h1 style={{
              fontSize: 'clamp(48px, 8vw, 92px)',
              fontWeight: 800,
              letterSpacing: '-0.05em',
              lineHeight: 0.96,
              color: 'var(--black-100)',
              margin: '0 auto',
            }}>
              Your video.<br />Every language.
            </h1>
          </div>

          {/* Step 3: Subhead / Secondary Technical Info */}
          <div className="hero-stagger-3" style={{ marginBottom: '36px' }}>
            <p style={{
              fontSize: 'clamp(16px, 2vw, 19px)',
              color: 'var(--black-65)',
              maxWidth: '540px',
              margin: '0 auto',
              lineHeight: 1.5,
              fontWeight: 400,
            }}>
              AI-powered video translation and dubbing. Upload your video, choose a language, and generate studio-quality dubbed voices in seconds.
            </p>
          </div>

          {/* Step 4: Primary Action Group */}
          <div className="hero-stagger-4" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}>
            <button
              onClick={onStartDubbing}
              className="btn btn-primary btn-lg btn-arrow-group"
              style={{
                padding: '13px 28px',
                fontSize: '14.5px',
                fontWeight: 600,
              }}
            >
              <span>Start dubbing</span>
              <span className="arrow-symbol">→</span>
            </button>
            <button
              onClick={onOpenPricing}
              className="btn btn-secondary btn-lg"
              style={{
                padding: '13px 24px',
                fontSize: '14.5px',
                fontWeight: 500,
              }}
            >
              View pricing
            </button>
          </div>
        </div>

        {/* 2. Redesigned Unified Product Visual / Hero Demo Section */}
        <div className="product-visual-container">
          <div style={{
            border: '1px solid var(--black-12)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            backgroundColor: '#030303',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.08)',
          }}>
            {/* Top Studio Control Bar */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: '#080808',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="mono" style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  LIVE COMPARISON STUDIO
                </span>
                <span style={{
                  fontSize: '9.5px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  padding: '2px 7px',
                  borderRadius: '2px',
                  letterSpacing: '0.05em',
                  fontFamily: 'var(--font-mono)',
                }}>
                  INTERACTIVE
                </span>
              </div>

              {/* Language Selector Switcher */}
              <div style={{ display: 'flex', gap: '4px' }}>
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
                      background: demoLang === item.code ? '#ffffff' : 'rgba(255, 255, 255, 0.05)',
                      color: demoLang === item.code ? '#000000' : 'rgba(255, 255, 255, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      fontSize: '11.5px',
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

            {/* 3-Column Transformation Area: Original -> Dubbing Signal -> Dubbed */}
            <div style={{ padding: '36px 32px 28px' }}>
              <div className="product-transformation-grid">
                {/* Column 1: ORIGINAL SIDE */}
                <div className="demo-stagger-left" style={{ textAlign: 'left' }}>
                  {/* Symmetrical Label Structure */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                  }}>
                    <div>
                      <div className="mono" style={{
                        fontSize: '11.5px',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'rgba(255, 255, 255, 0.5)',
                        marginBottom: '2px',
                      }}>
                        ORIGINAL • <span style={{ opacity: 0.8 }}>Source Video</span>
                      </div>
                      <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                        Original: English
                      </h3>
                    </div>

                    <button
                      onClick={() => handlePlayDemo('original', demoLang)}
                      className="btn btn-secondary btn-sm"
                      style={{
                        backgroundColor: demoTrack === 'original' && isPlayingDemo ? '#ffffff' : 'rgba(255, 255, 255, 0.06)',
                        color: demoTrack === 'original' && isPlayingDemo ? '#000000' : '#ffffff',
                        border: '1px solid rgba(255, 255, 255, 0.22)',
                        padding: '5px 11px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      {demoTrack === 'original' && isPlayingDemo ? <Volume2 size={12} /> : <Play size={12} />}
                      {demoTrack === 'original' && isPlayingDemo ? 'Playing' : 'Listen original'}
                    </button>
                  </div>

                  {/* 16:9 Video Frame Visual Surface */}
                  <div className="demo-video-frame" style={{ marginBottom: '14px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="mono" style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.45)', textTransform: 'uppercase' }}>
                        TRACK A // 44.1 kHz
                      </span>
                      <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '1px 5px', borderRadius: '2px' }}>
                        EN-US
                      </span>
                    </div>

                    {/* Speech Transcript Preview Box */}
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-xs)',
                      margin: '10px 0',
                    }}>
                      <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.9)', lineHeight: 1.5, fontWeight: 400 }}>
                        "{demoPhrases.en}"
                      </p>
                    </div>

                    {/* Synchronized Waveform */}
                    <Waveform
                      isPlaying={demoTrack === 'original' && isPlayingDemo}
                      barsCount={34}
                      height={24}
                      color="white"
                      seed={24}
                    />
                  </div>
                </div>

                {/* Column 2: THE SIGNATURE DUBBING SIGNAL */}
                <div className="product-signal-column demo-stagger-center">
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <span className="mono" style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'rgba(255, 255, 255, 0.65)',
                      letterSpacing: '0.06em',
                    }}>
                      EN
                    </span>

                    {/* Minimal Geometric Flow Waveform SVG */}
                    <svg width="72" height="24" viewBox="0 0 72 24" fill="none" style={{ overflow: 'visible' }}>
                      {/* Base Background Static Trace */}
                      <path
                        d="M 0,12 H 18 L 24,4 L 30,20 L 36,4 L 42,20 L 48,12 H 66"
                        stroke="rgba(255, 255, 255, 0.2)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Arrow Head */}
                      <path
                        d="M 62,8 L 68,12 L 62,16"
                        stroke="rgba(255, 255, 255, 0.4)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Traveling Active Signal Beam */}
                      <path
                        className="dubbing-signal-pulse"
                        d="M 0,12 H 18 L 24,4 L 30,20 L 36,4 L 42,20 L 48,12 H 66 M 62,8 L 68,12 L 62,16"
                        stroke="#ffffff"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>

                    <span className="mono" style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#ffffff',
                      letterSpacing: '0.06em',
                    }}>
                      {demoLang.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Column 3: DUBBED SIDE */}
                <div className="demo-stagger-right" style={{ textAlign: 'left' }}>
                  {/* Symmetrical Label Structure */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginBottom: '10px',
                  }}>
                    <div>
                      <div className="mono" style={{
                        fontSize: '11.5px',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'rgba(255, 255, 255, 0.5)',
                        marginBottom: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}>
                        DUBBED • <span style={{ opacity: 0.8 }}>Synthesized Dub</span>
                        <Sparkles size={10} color="#ffffff" style={{ marginLeft: '2px' }} />
                      </div>
                      <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                        Dubbed: {demoLang === 'uz' ? "Uzbek (Farrux)" : demoLang === 'es' ? "Spanish (Elena)" : demoLang === 'ja' ? "Japanese (Kenji)" : "German (Marcus)"}
                      </h3>
                    </div>

                    <button
                      onClick={() => handlePlayDemo('dubbed', demoLang)}
                      className="btn btn-white btn-sm"
                      style={{
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      {demoTrack === 'dubbed' && isPlayingDemo ? <Volume2 size={12} /> : <Play size={12} />}
                      {demoTrack === 'dubbed' && isPlayingDemo ? 'Playing dub' : 'Play dubbed AI'}
                    </button>
                  </div>

                  {/* 16:9 Video Frame Visual Surface */}
                  <div className="demo-video-frame" style={{ marginBottom: '14px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="mono" style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.45)', textTransform: 'uppercase' }}>
                        TRACK B // NEURAL SYNTHESIS
                      </span>
                      <span style={{ fontSize: '10px', color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.15)', padding: '1px 5px', borderRadius: '2px', fontFamily: 'var(--font-mono)' }}>
                        {demoLang.toUpperCase()}
                      </span>
                    </div>

                    {/* Speech Transcript Preview Box */}
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.07)',
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-xs)',
                      margin: '10px 0',
                    }}>
                      <p style={{ fontSize: '13px', color: '#ffffff', lineHeight: 1.5, fontWeight: 500 }}>
                        "{demoPhrases[demoLang]}"
                      </p>
                    </div>

                    {/* Synchronized Waveform */}
                    <Waveform
                      isPlaying={demoTrack === 'dubbed' && isPlayingDemo}
                      barsCount={34}
                      height={24}
                      color="white"
                      seed={88}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Language Transformation Visualization Line */}
              <div style={{
                marginTop: '28px',
                paddingTop: '20px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  width: '360px',
                  maxWidth: '100%',
                }}>
                  <span className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255, 255, 255, 0.6)' }}>
                    EN
                  </span>
                  <div style={{
                    flex: 1,
                    height: '1px',
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                  }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)', transform: 'translateY(-0.5px)' }}>▶</span>
                  </div>
                  <span className="mono" style={{ fontSize: '12px', fontWeight: 700, color: '#ffffff' }}>
                    {demoLang.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Demo Bar Action */}
            <div style={{
              padding: '14px 24px',
              backgroundColor: '#000000',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '11.5px', color: 'rgba(255, 255, 255, 0.55)' }}>
                Lip-sync preserved • Zero cadence distortion • 44.1 kHz neural output
              </span>
              <button
                onClick={onStartDubbing}
                className="btn-arrow-group"
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
                <span>Try with your own video</span>
                <span className="arrow-symbol">→</span>
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

      {/* 3. Technical / Features Specification Section */}
      <section className="tech-spec-section">
        <div className="tech-spec-container">
          {/* Top Section Header */}
          <div className="tech-spec-header">
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <span className="mono" style={{
                fontSize: '12.5px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--black-60)',
              }}>
                02 / CAPABILITIES
              </span>
              <h2 style={{
                fontSize: 'clamp(40px, 5.5vw, 68px)',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                lineHeight: 0.98,
                color: 'var(--black-100)',
                maxWidth: '900px',
                marginTop: '4px',
              }}>
                Engineered for clarity.
              </h2>
              <p style={{
                fontSize: 'clamp(16px, 1.8vw, 18px)',
                color: 'var(--black-65)',
                maxWidth: '640px',
                lineHeight: 1.55,
                marginTop: '16px',
                fontWeight: 400,
              }}>
                Built for high-velocity creators and global enterprises requiring broadcast fidelity.
              </p>
            </div>
          </div>

          {/* Sequential Editorial Technical Specification Rows */}
          <div>
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
              <div key={idx} className="tech-spec-row">
                {/* Column 1: Existing Identifier Tag */}
                <div className="tech-spec-tag">
                  [ {feat.tag} ]
                </div>

                {/* Column 2: Existing Feature Title */}
                <div className="tech-spec-title">
                  {feat.title}
                </div>

                {/* Column 3: Existing Technical Description */}
                <div className="tech-spec-desc">
                  {feat.desc}
                </div>
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
            className="btn btn-white btn-lg btn-arrow-group"
            style={{
              padding: '16px 36px',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            <span>Start dubbing</span>
            <span className="arrow-symbol">→</span>
          </button>
        </div>
      </section>
    </div>
  );
};
