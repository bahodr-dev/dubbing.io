import React, { useState, useEffect, useRef } from 'react';
import type { Project, TranscriptSegment } from '../types';
import { Play, Pause, Volume2, VolumeX, Maximize2, Subtitles, Sparkles } from 'lucide-react';
import { Waveform } from './Waveform';
import { playVoiceSample, stopVoiceSample } from '../audio/audioSynth';
import { VOICES } from '../data/voices';

interface VideoPlayerProps {
  project: Project;
  activeTrack: 'original' | 'dubbed';
  onChangeTrack: (track: 'original' | 'dubbed') => void;
  onTimeUpdate?: (currentTime: number) => void;
  seekTime?: number | null;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  project,
  activeTrack,
  onChangeTrack,
  onTimeUpdate,
  seekTime,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(project.duration || 24.5);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(Date.now());

  // Current active subtitle segment
  const activeSegment: TranscriptSegment | undefined = project.transcript.find(
    seg => currentTime >= seg.startTime && currentTime <= seg.endTime
  );

  useEffect(() => {
    setDuration(project.duration || 24.5);
    setCurrentTime(0);
    setIsPlaying(false);
    stopVoiceSample();
    return () => {
      stopVoiceSample();
    };
  }, [project.id]);

  useEffect(() => {
    if (typeof seekTime === 'number' && !isNaN(seekTime)) {
      setCurrentTime(seekTime);
      if (onTimeUpdate) onTimeUpdate(seekTime);
    }
  }, [seekTime]);

  // Handle Play / Pause with Audio Engine
  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopVoiceSample();
    } else {
      setIsPlaying(true);
      lastTickTimeRef.current = Date.now();

      // Trigger audio synth for speech track preview
      const voice = VOICES.find(v => v.id === project.voiceId) || VOICES[1];
      const textToSpeak = activeSegment 
        ? (activeTrack === 'dubbed' ? activeSegment.translatedText : activeSegment.originalText)
        : (activeTrack === 'dubbed' ? project.transcript[0]?.translatedText : project.transcript[0]?.originalText);

      playVoiceSample(voice.name, {
        gender: voice.gender,
        languageCode: activeTrack === 'dubbed' ? project.targetLanguage : project.originalLanguage,
        sampleText: textToSpeak,
        speed: playbackSpeed,
      });
    }
  };

  // Playback timer ticker
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const tick = () => {
      const now = Date.now();
      const deltaSeconds = (now - lastTickTimeRef.current) / 1000;
      lastTickTimeRef.current = now;

      setCurrentTime(prev => {
        const next = prev + deltaSeconds * playbackSpeed;
        if (next >= duration) {
          setIsPlaying(false);
          stopVoiceSample();
          return 0;
        }
        if (onTimeUpdate) onTimeUpdate(next);
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, duration, playbackSpeed, onTimeUpdate]);

  // Render high-end animated monochrome canvas video presentation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const renderCanvas = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Dark background
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, width, height);

      // Subtle architectural studio grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Speaker focal circle with animated audio frequency halo
      const centerX = width / 2;
      const centerY = height / 2 - 20;
      const radius = 64;

      if (isPlaying) {
        const pulse = Math.sin(currentTime * 8) * 8;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 16 + pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 32 + pulse * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Main silhouette speaker circle
      ctx.fillStyle = '#141414';
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Speaker icon / initials
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px Figtree, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(activeTrack === 'dubbed' ? 'AI VO' : 'ORIG', centerX, centerY);

      // Status indicator overlay top-left
      ctx.font = '11px JetBrains Mono, monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(`REC: ${project.videoQuality || '1080p'} • ${activeTrack === 'dubbed' ? 'AI DUBBED TRACK (UZ)' : 'ORIGINAL AUDIO (EN)'}`, 24, 32);

      // Top right timecode badge
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.fillText(`${formatTime(currentTime)} / ${formatTime(duration)}`, width - 24, 32);

      animId = requestAnimationFrame(renderCanvas);
    };

    renderCanvas();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [currentTime, duration, isPlaying, activeTrack, project]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
  };

  const handleWaveformSeek = (pct: number) => {
    setCurrentTime(pct * duration);
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  }

  return (
    <div
      ref={containerRef}
      style={{
        backgroundColor: 'var(--black-100)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid var(--black-100)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Viewport Area */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', backgroundColor: '#050505' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          style={{ width: '100%', height: '100%', display: 'block' }}
          onClick={togglePlay}
        />

        {/* Floating Subtitle Overlay */}
        {showSubtitles && activeSegment && (
          <div style={{
            position: 'absolute',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            maxWidth: '85%',
            textAlign: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            padding: '10px 20px',
            borderRadius: 'var(--radius-sm)',
            backdropFilter: 'blur(4px)',
            animation: 'fadeIn 150ms ease',
          }}>
            <p style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--white-100)',
              lineHeight: 1.4,
              letterSpacing: '-0.01em',
            }}>
              {activeTrack === 'dubbed' ? activeSegment.translatedText : activeSegment.originalText}
            </p>
            <div style={{
              fontSize: '11px',
              color: 'var(--white-70)',
              marginTop: '4px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              {activeTrack === 'dubbed' ? `Uzbek Neural Voice (Farrux)` : `Original English Speech`}
            </div>
          </div>
        )}

        {/* Audio Track Switcher Floating Pill */}
        {project.status === 'completed' && (
          <div style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            display: 'flex',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 'var(--radius-pill)',
            overflow: 'hidden',
            padding: '3px',
            zIndex: 10,
          }}>
            <button
              type="button"
              onClick={() => onChangeTrack('original')}
              style={{
                background: activeTrack === 'original' ? 'var(--white-100)' : 'transparent',
                color: activeTrack === 'original' ? 'var(--black-100)' : 'var(--white-70)',
                border: 'none',
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                borderRadius: 'var(--radius-pill)',
                transition: 'all 120ms ease',
              }}
            >
              Original ({project.originalLanguage.toUpperCase()})
            </button>
            <button
              type="button"
              onClick={() => onChangeTrack('dubbed')}
              style={{
                background: activeTrack === 'dubbed' ? 'var(--white-100)' : 'transparent',
                color: activeTrack === 'dubbed' ? 'var(--black-100)' : 'var(--white-70)',
                border: 'none',
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                borderRadius: 'var(--radius-pill)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 120ms ease',
              }}
            >
              <Sparkles size={11} />
              Dubbed ({project.targetLanguage.toUpperCase()})
            </button>
          </div>
        )}
      </div>

      {/* Waveform Scrubbing Track */}
      <div style={{
        backgroundColor: '#0a0a0a',
        padding: '8px 16px 4px',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        <Waveform
          isPlaying={isPlaying}
          progress={currentTime / (duration || 1)}
          barsCount={72}
          height={28}
          color="white"
          interactive
          onSeek={handleWaveformSeek}
          seed={100}
        />
      </div>

      {/* Playback Controls & Scrubber */}
      <div style={{ padding: '16px 20px', backgroundColor: 'var(--black-100)', color: 'var(--white-100)' }}>
        {/* Progress Scrubber */}
        <div style={{ marginBottom: '14px', position: 'relative' }}>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            className="timeline-slider"
          />
        </div>

        {/* Action Controls Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={togglePlay}
              className="btn btn-white btn-sm"
              style={{ padding: '6px 14px', fontWeight: 600 }}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <div className="mono" style={{ fontSize: '12px', color: 'var(--white-90)' }}>
              {formatTime(currentTime)} <span style={{ color: 'var(--white-40)' }}>/ {formatTime(duration)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Speed selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {[1, 1.25, 1.5].map(spd => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  style={{
                    background: playbackSpeed === spd ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                    color: playbackSpeed === spd ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '2px 8px',
                    fontSize: '11px',
                    borderRadius: 'var(--radius-xs)',
                    cursor: 'pointer',
                  }}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Subtitles Toggle */}
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              style={{
                background: 'none',
                border: 'none',
                color: showSubtitles ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
              title="Toggle Subtitles"
            >
              <Subtitles size={16} />
            </button>

            {/* Volume */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setIsMuted(!isMuted)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={e => { setVolume(parseFloat(e.target.value)); setIsMuted(false); }}
                style={{ width: '60px', accentColor: '#ffffff', cursor: 'pointer' }}
              />
            </div>

            {/* Fullscreen */}
            <button
              onClick={handleFullscreen}
              style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              title="Fullscreen"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
