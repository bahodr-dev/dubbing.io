import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Project, TranscriptSegment } from '../types';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Subtitles,
  Sparkles,
  UploadCloud,
  Film,
  RotateCcw,
  RotateCw,
  SkipBack,
  Headphones,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import './VideoPlayer.css';
import { playVoiceSample, stopVoiceSample } from '../audio/audioSynth';
import { VOICES } from '../data/voices';
import { api } from '../services/api';
import { useDialogFocus } from '../hooks/useDialogFocus';

interface VideoPlayerProps {
  project: Project;
  activeTrack: 'original' | 'dubbed';
  onChangeTrack: (track: 'original' | 'dubbed') => void;
  onTimeUpdate?: (currentTime: number) => void;
  seekTime?: number | null;
  onVideoUploaded?: (videoUrl: string, duration?: number, mediaId?: string) => void;
}

// Helper to extract YouTube video ID from various URL formats
function getYouTubeId(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?/\s]{11})/i);
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const exitExpandedRef = useRef<HTMLButtonElement | null>(null);
  const lastSpokenSegmentIdRef = useRef<string | null>(null);

  useDialogFocus({
    isOpen: isExpanded,
    dialogRef: containerRef,
    initialFocusRef: exitExpandedRef,
    onClose: () => setIsExpanded(false),
  });

  const hasRenderedDub = Boolean(project.dubbedVideoUrl);
  const playbackUrl = activeTrack === 'dubbed' && project.dubbedVideoUrl
    ? project.dubbedVideoUrl
    : project.videoUrl;

  // Determine media source type
  const youtubeId = useMemo(() => getYouTubeId(playbackUrl), [playbackUrl]);
  const vimeoId = useMemo(() => getVimeoId(playbackUrl), [playbackUrl]);
  const hasDirectVideo = Boolean(
    playbackUrl &&
    !youtubeId &&
    !vimeoId &&
    (playbackUrl.startsWith('http') ||
      playbackUrl.startsWith('/') ||
      playbackUrl.startsWith('blob:') ||
      playbackUrl.startsWith('data:'))
  );

  // Current active subtitle segment based on playback timestamp
  const activeSegment: TranscriptSegment | undefined = project.transcript.find(
    (seg) => currentTime >= seg.startTime && currentTime <= seg.endTime
  );

  // Reset playback only when the media changes, not when its metadata is refreshed.
  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(false);
    lastSpokenSegmentIdRef.current = null;
    stopVoiceSample();
    return () => {
      stopVoiceSample();
    };
  }, [project.id, playbackUrl]);

  useEffect(() => {
    const media = videoRef.current;
    const nativeDuration = media?.readyState ? media.duration : undefined;
    setDuration(nativeDuration && Number.isFinite(nativeDuration) ? nativeDuration : project.duration || 30);
  }, [project.id, playbackUrl, project.duration]);

  // Handle external seek time props (e.g. clicking transcript segment in right column)
  useEffect(() => {
    if (typeof seekTime === 'number' && !isNaN(seekTime)) {
      setCurrentTime(seekTime);
      if (videoRef.current) {
        videoRef.current.currentTime = seekTime;
      }
      if (onTimeUpdate) onTimeUpdate(seekTime);
    }
  }, [seekTime, onTimeUpdate]);

  // Synchronize audio track mode with video element
  useEffect(() => {
    if (videoRef.current) {
      if (activeTrack === 'dubbed' && !hasRenderedDub) {
        // In dubbed mode, mute/duck original video audio so neural voice is crisp
        videoRef.current.volume = 0.05;
      } else {
        videoRef.current.volume = isMuted ? 0 : volume;
        videoRef.current.muted = isMuted;
      }
    }
  }, [activeTrack, volume, isMuted, hasRenderedDub]);

  // Synchronize neural voice synthesis when active subtitle segment changes in Dubbed mode
  useEffect(() => {
    if (!isPlaying || activeTrack !== 'dubbed' || hasRenderedDub) return;

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
  }, [activeSegment, isPlaying, activeTrack, project.targetLanguage, project.voiceId, playbackSpeed, hasRenderedDub]);

  const seekDelta = useCallback((seconds: number) => {
    const newTime = Math.max(0, Math.min(duration, currentTime + seconds));
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    if (onTimeUpdate) onTimeUpdate(newTime);
  }, [currentTime, duration, onTimeUpdate]);

  const togglePlay = useCallback(() => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        setPlaybackError(null);
        videoRef.current.play().catch(() => {
          setIsPlaying(false);
          setPlaybackError('Playback could not start. Please try again.');
        });
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
  }, [isPlaying]);

  // Handle keyboard shortcuts (Space for Play/Pause, Left/Right for seeking)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (e.defaultPrevented || document.querySelector('[aria-modal="true"]') || activeEl?.closest(
        'input, textarea, select, button, a, [role="button"], [contenteditable="true"]'
      )) return;

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
  }, [seekDelta, togglePlay]);

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

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (isExpanded) {
      setIsExpanded(false);
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else if (document.fullscreenEnabled && containerRef.current.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => setIsExpanded(true));
    } else {
      setIsExpanded(true);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
        onVideoUploaded(res.url, undefined, res.mediaId || res.id);
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

  const progress = Math.max(0, Math.min(100, (currentTime / (duration || 1)) * 100));
  const isEmbedded = Boolean(youtubeId || vimeoId);
  const canControlPlayback = hasDirectVideo;
  const subtitleText = activeTrack === 'dubbed'
    ? activeSegment?.translatedText || activeSegment?.originalText
    : activeSegment?.originalText;

  return (
    <div
      ref={containerRef}
      className={`studio-video-player${isExpanded ? ' vp-expanded' : ''}`}
      role={isExpanded ? 'dialog' : 'region'}
      aria-modal={isExpanded || undefined}
      aria-label="Video preview"
      tabIndex={-1}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/mkv,audio/mp3,audio/wav"
        className="vp-file-input"
        aria-label="Choose replacement video"
        onChange={handleDirectFileUpload}
      />

      <header className="vp-header">
        <div className="vp-heading">
          <span className="vp-heading-icon"><Film size={18} aria-hidden="true" /></span>
          <h2>Video preview</h2>
        </div>
        {isExpanded || isFullscreen ? (
          <button ref={exitExpandedRef} type="button" className="vp-replace" onClick={handleFullscreen} aria-label="Close expanded preview">
            <Minimize2 size={15} /><span>Close preview</span>
          </button>
        ) : <button
          type="button"
          className="vp-replace"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          aria-label={project.videoUrl ? 'Replace video' : 'Upload video'}
        >
          {isUploading ? <Loader2 size={15} className="spin" /> : <UploadCloud size={15} />}
          <span>{isUploading ? 'Uploading…' : project.videoUrl ? 'Replace video' : 'Upload video'}</span>
        </button>}
      </header>

      <div className="vp-source-row">
        <div className="vp-track-switch" role="group" aria-label="Audio track">
          <button type="button" onClick={() => onChangeTrack('original')} aria-pressed={activeTrack === 'original'}>
            <Headphones size={14} aria-hidden="true" />
            <span>Original</span>
            <span className="vp-language">{project.originalLanguage.toUpperCase()}</span>
          </button>
          <button type="button" onClick={() => onChangeTrack('dubbed')} aria-pressed={activeTrack === 'dubbed'}>
            <Sparkles size={14} aria-hidden="true" />
            <span>Dubbed</span>
            <span className="vp-language">{project.targetLanguage.toUpperCase()}</span>
          </button>
        </div>
        <button
          type="button"
          className="vp-caption-toggle"
          onClick={() => setShowSubtitles(!showSubtitles)}
          aria-label="Toggle subtitles"
          aria-pressed={showSubtitles}
          title={showSubtitles ? 'Hide subtitles' : 'Show subtitles'}
        >
          <Subtitles size={17} aria-hidden="true" />
          <span>Captions</span>
        </button>
      </div>

      <div className="vp-stage">
        {hasDirectVideo && (
          <video
            ref={videoRef}
            src={playbackUrl}
            className="vp-media"
            playsInline
            preload="metadata"
            crossOrigin="anonymous"
            aria-label={project.title}
            onClick={togglePlay}
            onPlay={() => { setIsPlaying(true); setPlaybackError(null); }}
            onPause={() => { setIsPlaying(false); stopVoiceSample(); }}
            onTimeUpdate={() => {
              if (videoRef.current) {
                const time = videoRef.current.currentTime;
                setCurrentTime(time);
                onTimeUpdate?.(time);
              }
            }}
            onLoadedMetadata={() => {
              const nativeDuration = videoRef.current?.duration;
              if (nativeDuration && Number.isFinite(nativeDuration)) setDuration(nativeDuration);
            }}
            onWaiting={() => setIsBuffering(true)}
            onCanPlay={() => { setIsBuffering(false); setPlaybackError(null); }}
            onError={() => { setIsBuffering(false); setIsPlaying(false); setPlaybackError('This video could not be loaded. Try replacing the file.'); }}
            onEnded={() => { setIsPlaying(false); stopVoiceSample(); }}
          />
        )}

        {youtubeId && (
          <iframe
            className="vp-media"
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=0&enablejsapi=1&rel=0`}
            title="YouTube Video Player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
        {vimeoId && (
          <iframe
            className="vp-media"
            src={`https://player.vimeo.com/video/${vimeoId}`}
            title="Vimeo Video Player"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        )}

        {!hasDirectVideo && !isEmbedded && (
          <button type="button" className="vp-empty" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            <span className="vp-empty-icon"><UploadCloud size={28} /></span>
            <strong>{isUploading ? 'Uploading your video…' : 'Bring your video into focus'}</strong>
            <span>Choose a video to preview your dub.</span>
            <span className="vp-empty-action">Choose file</span>
          </button>
        )}

        {hasDirectVideo && !isPlaying && !isBuffering && !playbackError && (
          <button type="button" className="vp-stage-play" onClick={togglePlay} aria-label="Play preview">
            <Play size={25} fill="currentColor" aria-hidden="true" />
          </button>
        )}

        {isBuffering && (
          <div className="vp-stage-message" role="status">
            <Loader2 size={22} className="spin" /><span>Loading video…</span>
          </div>
        )}
        {playbackError && (
          <div className="vp-stage-message vp-stage-error" role="alert">
            <Film size={24} /><span>{playbackError}</span>
          </div>
        )}

        {showSubtitles && subtitleText && (hasDirectVideo || isEmbedded) && !playbackError && (
          <div className="vp-subtitles"><span>{subtitleText}</span></div>
        )}
      </div>

      <div className="vp-playback">
        {isEmbedded ? (
          <p className="vp-embed-note">Use the controls inside the video to play and seek.</p>
        ) : (
          <div className="vp-timeline">
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={0.05}
              value={Math.min(currentTime, duration)}
              onChange={handleSeek}
              disabled={!canControlPlayback}
              className="vp-seek"
              style={{ '--vp-progress': `${progress}%` } as React.CSSProperties}
              aria-label="Video timeline"
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            />
            <div className="vp-time-row">
              <span className="vp-current-time">{formatTime(currentTime)}</span>
              <button type="button" onClick={() => seekDelta(-currentTime)} disabled={!canControlPlayback} className="vp-restart" aria-label="Rewind to start" title="Back to start">
                <SkipBack size={12} /><span>Back to start</span>
              </button>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        )}

        <div className="vp-transport">
          <div className="vp-volume">
            <button
              type="button"
              className="vp-icon-button"
              onClick={() => setIsMuted(!isMuted)}
              disabled={!canControlPlayback}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <input
              type="range"
              aria-label="Volume"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              disabled={!canControlPlayback}
              onChange={(event) => { setVolume(Number(event.target.value)); setIsMuted(false); }}
            />
          </div>

          <div className="vp-main-controls">
            <button type="button" className="vp-skip" onClick={() => seekDelta(-5)} disabled={!canControlPlayback} aria-label="Back 5 seconds" title="Back 5 seconds">
              <RotateCcw size={24} /><span>5</span>
            </button>
            <button type="button" className="vp-play" onClick={togglePlay} disabled={!canControlPlayback} aria-label={isPlaying ? 'Pause video' : 'Play video'} title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button type="button" className="vp-skip" onClick={() => seekDelta(5)} disabled={!canControlPlayback} aria-label="Forward 5 seconds" title="Forward 5 seconds">
              <RotateCw size={24} /><span>5</span>
            </button>
          </div>

          <div className="vp-options">
            <label className="vp-speed" title="Playback speed">
              <select aria-label="Playback speed" value={playbackSpeed} disabled={!canControlPlayback} onChange={(event) => handleSpeedChange(Number(event.target.value))}>
                {[0.75, 1, 1.25, 1.5, 2].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
              </select>
              <ChevronDown size={12} aria-hidden="true" />
            </label>
            <button type="button" className="vp-icon-button" onClick={handleFullscreen} aria-label={isFullscreen || isExpanded ? 'Exit fullscreen' : 'Fullscreen'} title={isFullscreen || isExpanded ? 'Exit fullscreen' : 'Fullscreen'}>
              {isFullscreen || isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
