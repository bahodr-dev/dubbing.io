import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Project, TranscriptSegment } from '../types';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Subtitles,
  Sparkles,
  UploadCloud,
  Film,
  RotateCcw,
  Loader2,
} from 'lucide-react';
import { Waveform } from './Waveform';
import { playVoiceSample, stopVoiceSample } from '../audio/audioSynth';
import { VOICES } from '../data/voices';
import { api } from '../services/api';

interface VideoPlayerProps {
  project: Project;
  activeTrack: 'original' | 'dubbed';
  onChangeTrack: (track: 'original' | 'dubbed') => void;
  onTimeUpdate?: (currentTime: number) => void;
  seekTime?: number | null;
  onVideoUploaded?: (videoUrl: string, duration?: number) => void;
}

// Helper to extract YouTube video ID from various URL formats
function getYouTubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
}

// Helper to extract Vimeo ID
function getVimeoId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:vimeo\.com\/)(\d+)/i);
  return match ? match[1] : null;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  project,
  activeTrack,
  onChangeTrack,
  onTimeUpdate,
  seekTime,
  onVideoUploaded,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(project.duration || 30);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSpokenSegmentIdRef = useRef<string | null>(null);

  // Determine media source type
  const youtubeId = useMemo(() => getYouTubeId(project.videoUrl), [project.videoUrl]);
  const vimeoId = useMemo(() => getVimeoId(project.videoUrl), [project.videoUrl]);
  const hasDirectVideo = Boolean(
    project.videoUrl &&
    !youtubeId &&
    !vimeoId &&
    (project.videoUrl.startsWith('http') ||
      project.videoUrl.startsWith('/') ||
      project.videoUrl.startsWith('blob:') ||
      project.videoUrl.startsWith('data:'))
  );

  // Current active subtitle segment based on playback timestamp
  const activeSegment: TranscriptSegment | undefined = project.transcript.find(
    (seg) => currentTime >= seg.startTime && currentTime <= seg.endTime
  );

  // Sync duration and reset on project change
  useEffect(() => {
    setDuration(project.duration || 30);
    setCurrentTime(0);
    setIsPlaying(false);
    lastSpokenSegmentIdRef.current = null;
    stopVoiceSample();
    return () => {
      stopVoiceSample();
    };
  }, [project.id]);

  // Handle external seek time props (e.g. clicking transcript segment in right column)
  useEffect(() => {
    if (typeof seekTime === 'number' && !isNaN(seekTime)) {
      setCurrentTime(seekTime);
      if (videoRef.current) {
        videoRef.current.currentTime = seekTime;
      }
      if (onTimeUpdate) onTimeUpdate(seekTime);
    }
  }, [seekTime]);

  // Synchronize audio track mode with video element
  useEffect(() => {
    if (videoRef.current) {
      if (activeTrack === 'dubbed') {
        // In dubbed mode, mute/duck original video audio so neural voice is crisp
        videoRef.current.volume = 0.05;
      } else {
        videoRef.current.volume = isMuted ? 0 : volume;
        videoRef.current.muted = isMuted;
      }
    }
  }, [activeTrack, volume, isMuted]);

  // Synchronize neural voice synthesis when active subtitle segment changes in Dubbed mode
  useEffect(() => {
    if (!isPlaying || activeTrack !== 'dubbed') return;

    if (activeSegment && activeSegment.id !== lastSpokenSegmentIdRef.current) {
      lastSpokenSegmentIdRef.current = activeSegment.id;
      const voice = VOICES.find((v) => v.id === project.voiceId) || VOICES[1];
      const textToSpeak = activeSegment.translatedText || activeSegment.originalText;

      if (textToSpeak) {
        playVoiceSample(voice.name, {
          gender: voice.gender,
          languageCode: project.targetLanguage,
          sampleText: textToSpeak,
          speed: playbackSpeed,
        });
      }
    } else if (!activeSegment) {
      lastSpokenSegmentIdRef.current = null;
    }
  }, [activeSegment, isPlaying, activeTrack, project.targetLanguage, project.voiceId, playbackSpeed]);

  // Handle keyboard shortcuts (Space for Play/Pause, Left/Right for seeking)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT');
      if (isInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekDelta(-5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekDelta(5);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, duration]);

  const seekDelta = (seconds: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    if (onTimeUpdate) onTimeUpdate(newTime);
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch((err) => console.warn('Playback blocked:', err));
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
        stopVoiceSample();
      }
    } else {
      // Fallback synthetic play if no HTML5 video
      if (isPlaying) {
        setIsPlaying(false);
        stopVoiceSample();
      } else {
        setIsPlaying(true);
      }
    }
  };

  // Synthetic timer ticker for projects without a native video element
  useEffect(() => {
    if (hasDirectVideo || !isPlaying) return;

    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 0.1 * playbackSpeed;
        if (next >= duration) {
          setIsPlaying(false);
          stopVoiceSample();
          return 0;
        }
        if (onTimeUpdate) onTimeUpdate(next);
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [hasDirectVideo, isPlaying, duration, playbackSpeed, onTimeUpdate]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    if (onTimeUpdate) onTimeUpdate(newTime);
  };

  const handleWaveformSeek = (pct: number) => {
    const newTime = pct * duration;
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    if (onTimeUpdate) onTimeUpdate(newTime);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local blob URL for immediate video rendering
    const localBlobUrl = URL.createObjectURL(file);
    if (onVideoUploaded) {
      onVideoUploaded(localBlobUrl);
    }

    // Upload to server in background
    setIsUploading(true);
    try {
      const res = await api.media.upload(file, project.id);
      if (res && res.url && onVideoUploaded) {
        onVideoUploaded(res.url);
      }
    } catch (err) {
      console.warn('Backend video upload fallback to local blob:', err);
    } finally {
      setIsUploading(false);
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
        backgroundColor: '#000000',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Hidden file input for uploading/replacing video */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/mkv,audio/mp3,audio/wav"
        style={{ display: 'none' }}
        onChange={handleDirectFileUpload}
      />

      {/* Main Viewport Area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16 / 9',
          backgroundColor: '#050505',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* 1. Direct HTML5 Video Player */}
        {hasDirectVideo && (
          <video
            ref={videoRef}
            src={project.videoUrl}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              backgroundColor: '#000000',
              cursor: 'pointer',
            }}
            playsInline
            crossOrigin="anonymous"
            onClick={togglePlay}
            onPlay={() => setIsPlaying(true)}
            onPause={() => {
              setIsPlaying(false);
              stopVoiceSample();
            }}
            onTimeUpdate={() => {
              if (videoRef.current) {
                const cur = videoRef.current.currentTime;
                setCurrentTime(cur);
                if (onTimeUpdate) onTimeUpdate(cur);
              }
            }}
            onLoadedMetadata={() => {
              if (videoRef.current && videoRef.current.duration) {
                const d = videoRef.current.duration;
                if (!isNaN(d) && isFinite(d) && d > 0) {
                  setDuration(d);
                }
              }
            }}
            onWaiting={() => setIsBuffering(true)}
            onCanPlay={() => setIsBuffering(false)}
            onEnded={() => {
              setIsPlaying(false);
              stopVoiceSample();
            }}
          />
        )}

        {/* 2. Embedded YouTube Player */}
        {youtubeId && (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=0&enablejsapi=1&rel=0`}
            title="YouTube Video Player"
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}

        {/* 3. Embedded Vimeo Player */}
        {vimeoId && (
          <iframe
            src={`https://player.vimeo.com/video/${vimeoId}`}
            title="Vimeo Video Player"
            style={{ width: '100%', height: '100%', border: 'none' }}
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        )}

        {/* 4. Fallback Placeholder / Direct Video Dropper when no video is attached */}
        {!hasDirectVideo && !youtubeId && !vimeoId && (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px',
              textAlign: 'center',
              cursor: 'pointer',
              width: '100%',
              height: '100%',
              background: 'radial-gradient(circle at center, #18181b 0%, #09090b 100%)',
              transition: 'background 200ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'radial-gradient(circle at center, #27272a 0%, #09090b 100%)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'radial-gradient(circle at center, #18181b 0%, #09090b 100%)')}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px dashed rgba(255, 255, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                color: '#FFFFFF',
              }}
            >
              {isUploading ? <Loader2 size={28} className="spin" /> : <UploadCloud size={28} />}
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#FFFFFF', marginBottom: '6px' }}>
              {isUploading ? 'Uploading video to studio...' : 'Click to upload your video (MP4, MOV, WEBM)'}
            </h3>
            <p style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)', maxWidth: '420px', lineHeight: 1.5 }}>
              Attach a video file to watch and dub in real-time with AI voice synchronization.
            </p>
          </div>
        )}

        {/* Buffering Spinner */}
        {isBuffering && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: '12px 18px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 600,
              zIndex: 20,
              pointerEvents: 'none',
            }}
          >
            <Loader2 size={16} className="spin" />
            <span>Buffering stream...</span>
          </div>
        )}

        {/* Floating Subtitle Overlay */}
        {showSubtitles && activeSegment && (
          <div
            style={{
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
              backdropFilter: 'blur(6px)',
              animation: 'fadeIn 150ms ease',
              zIndex: 15,
              pointerEvents: 'none',
            }}
          >
            <p
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'var(--white-100)',
                lineHeight: 1.4,
                letterSpacing: '-0.01em',
              }}
            >
              {activeTrack === 'dubbed'
                ? activeSegment.translatedText || activeSegment.originalText
                : activeSegment.originalText}
            </p>
            <div
              style={{
                fontSize: '10.5px',
                color: 'var(--white-70)',
                marginTop: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              {activeTrack === 'dubbed' ? (
                <>
                  <Sparkles size={11} color="#00C7B1" />
                  <span>Uzbek Neural Voice ({project.targetLanguage.toUpperCase()})</span>
                </>
              ) : (
                <span>Original Audio ({project.originalLanguage.toUpperCase()})</span>
              )}
            </div>
          </div>
        )}

        {/* Audio Track Switcher Floating Pill */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            display: 'flex',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 'var(--radius-pill)',
            overflow: 'hidden',
            padding: '3px',
            zIndex: 25,
            backdropFilter: 'blur(4px)',
          }}
        >
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

        {/* Change / Replace Video Button top-right */}
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 25 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary btn-sm"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              fontSize: '11.5px',
              padding: '5px 10px',
              backdropFilter: 'blur(4px)',
            }}
            title="Upload or replace studio video"
          >
            <Film size={13} />
            <span>{project.videoUrl ? 'Replace Video' : 'Upload Video'}</span>
          </button>
        </div>
      </div>

      {/* Waveform Scrubbing Track */}
      <div
        style={{
          backgroundColor: '#0a0a0a',
          padding: '8px 16px 4px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
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

      {/* Playback Controls & Scrubber Bar */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              type="button"
              onClick={togglePlay}
              className="btn btn-white btn-sm"
              style={{ padding: '6px 14px', fontWeight: 600 }}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentTime(0);
                if (videoRef.current) videoRef.current.currentTime = 0;
                if (onTimeUpdate) onTimeUpdate(0);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.6)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
              title="Rewind to start"
            >
              <RotateCcw size={15} />
            </button>

            <div className="mono" style={{ fontSize: '12px', color: 'var(--white-90)' }}>
              {formatTime(currentTime)}{' '}
              <span style={{ color: 'var(--white-40)' }}>/ {formatTime(duration)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Speed selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {[0.75, 1, 1.25, 1.5, 2].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => handleSpeedChange(spd)}
                  style={{
                    background: playbackSpeed === spd ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                    color: playbackSpeed === spd ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '2px 7px',
                    fontSize: '11px',
                    borderRadius: 'var(--radius-xs)',
                    cursor: 'pointer',
                    fontWeight: playbackSpeed === spd ? 700 : 400,
                  }}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Subtitles Toggle */}
            <button
              type="button"
              onClick={() => setShowSubtitles(!showSubtitles)}
              style={{
                background: showSubtitles ? 'rgba(255, 255, 255, 0.15)' : 'none',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: showSubtitles ? '#ffffff' : 'rgba(255, 255, 255, 0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: 'var(--radius-xs)',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
              }}
              title="Toggle Subtitles"
            >
              <Subtitles size={14} />
              <span>CC</span>
            </button>

            {/* Volume */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  setIsMuted(false);
                }}
                style={{ width: '60px', accentColor: '#ffffff', cursor: 'pointer' }}
              />
            </div>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={handleFullscreen}
              style={{
                background: 'none',
                border: 'none',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
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
