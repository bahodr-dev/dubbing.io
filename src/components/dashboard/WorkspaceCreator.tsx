import React, { useState, useRef, useEffect } from 'react';
import type { Project, Voice } from '../../types';
import { api } from '../../services/api';
import { checkMinutesBeforeUpload, checkUploadedMediaMinutes } from '../../utils/dubbingMinutes';
import {
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  ArrowUp,
  Loader2,
  ChevronDown,
  Globe,
  Link as LinkIcon,
  X,
} from 'lucide-react';

interface WorkspaceCreatorProps {
  voices: Voice[];
  onProjectCreated: (project: Project) => void | Promise<void>;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const WorkspaceCreator: React.FC<WorkspaceCreatorProps> = ({
  voices,
  onProjectCreated,
  onShowToast,
}) => {
  const [sourceMode, setSourceMode] = useState<'upload' | 'url'>('upload');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('uz');
  const [selectedVoiceId, setSelectedVoiceId] = useState('voice-farrux');
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const langDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setIsLangDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLanguageSelect = (code: string) => {
    setTargetLanguage(code);
    setIsLangDropdownOpen(false);
    // Find matching voice for this target language
    const matchingVoice = voices.find((v) => v.languageCode === code);
    if (matchingVoice) {
      setSelectedVoiceId(matchingVoice.id);
    }
  };

  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedFile(null);
    setUploadedFileName('');
    setProjectName('');
    setSourceError(null);
  };

  const LANGUAGES = [
    { code: 'uz', name: 'Uzbek (O\'zbek)' },
    { code: 'en', name: 'English (US)' },
    { code: 'es', name: 'Spanish (Español)' },
    { code: 'de', name: 'German (Deutsch)' },
    { code: 'fr', name: 'French (Français)' },
    { code: 'ja', name: 'Japanese (日本語)' },
    { code: 'ar', name: 'Arabic (العربية)' },
  ];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSourceError(null);
      setUploadedFile(file);
      setUploadedFileName(file.name);
      setProjectName(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  };

  const handleSubmit = async () => {
    if (!uploadedFileName && !videoUrl) {
      setSourceError('Choose a file or paste a direct media file URL before starting.');
      return;
    }

    setIsGenerating(true);
    setSourceError(null);
    const title =
      projectName ||
      (uploadedFileName ? uploadedFileName.replace(/\.[^/.]+$/, '') : 'Online Video Dub');

    let uploadedMediaId: string | undefined;
    let projectCreated = false;

    try {
      await checkMinutesBeforeUpload(uploadedFile);
      let finalMediaUrl = '';

      // 1. If file was selected, upload directly to backend
      if (uploadedFile) {
        try {
          const uploadRes = await api.media.upload(uploadedFile);
          finalMediaUrl = uploadRes.url;
          uploadedMediaId = uploadRes.mediaId || uploadRes.id;
        } catch (uploadErr: any) {
          console.warn('Media upload fallback:', uploadErr);
          throw uploadErr;
        }
      } else {
        const imported = await api.media.importUrl(videoUrl);
        finalMediaUrl = imported.url;
        uploadedMediaId = imported.mediaId || imported.id;
      }

      if (!uploadedMediaId) throw new Error('Media upload did not return an ID. Please try again.');
      const duration = await checkUploadedMediaMinutes(uploadedMediaId);

      const newProj: Project = {
        id: `proj-${Date.now()}`,
        title: title,
        originalLanguage: 'en',
        targetLanguage: targetLanguage,
        status: 'draft',
        duration,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        videoUrl: finalMediaUrl,
        mediaId: uploadedMediaId,
        thumbnailUrl:
          'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
        voiceId: selectedVoiceId || (targetLanguage === 'uz' ? 'voice-farrux' : 'voice-elena'),
        transcript: [],
      };

      // Persist before queueing so the job can be restored after navigation or
      // a browser refresh. The transcription worker updates its real duration.
      await onProjectCreated(newProj);
      projectCreated = true;
      await api.dubbing.transcribe({
        mediaId: uploadedMediaId,
        projectId: newProj.id,
        language: newProj.originalLanguage,
      });
      if (onShowToast) {
        onShowToast('Project saved. Transcription is starting in the studio.', 'success');
      }
    } catch (err: any) {
      if (uploadedMediaId && !projectCreated) {
        try { await api.media.delete(uploadedMediaId); } catch (cleanupError) {
          console.warn('Could not remove unused media after minute check:', cleanupError);
        }
      }
      setSourceError(err.message || 'We could not start this dubbing project. Please try again.');
      if (onShowToast) {
        onShowToast(err.message || 'Failed to start dubbing', 'error');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const getLanguageLabel = (code: string) => {
    const found = LANGUAGES.find((l) => l.code === code);
    return found ? found.name : code.toUpperCase();
  };

  return (
    <div
      className="workspace-creator"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '16px',
        padding: '16px 20px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)',
        marginBottom: '36px',
      }}
    >
      {/* Top Controls inside box: [Upload] [Paste URL] on left, Dubbing workspace on right */}
      <div
        className="workspace-creator-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <div
          className="workspace-source-toggle"
          style={{
            display: 'inline-flex',
            backgroundColor: '#F3F4F6',
            borderRadius: '10px',
            padding: '3px',
            gap: '2px',
          }}
        >
          <button
            type="button"
            className={`workspace-source-button ${sourceMode === 'upload' ? 'is-active' : ''}`}
            onClick={() => setSourceMode('upload')}
            style={{
              border: 'none',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: 'var(--text-control)',
              fontWeight: sourceMode === 'upload' ? 600 : 500,
              backgroundColor: sourceMode === 'upload' ? '#ffffff' : 'transparent',
              color: sourceMode === 'upload' ? '#000000' : 'rgba(0, 0, 0, 0.55)',
              boxShadow: sourceMode === 'upload' ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
          >
            Upload
          </button>
          <button
            type="button"
            className={`workspace-source-button ${sourceMode === 'url' ? 'is-active' : ''}`}
            onClick={() => setSourceMode('url')}
            style={{
              border: 'none',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: 'var(--text-control)',
              fontWeight: sourceMode === 'url' ? 600 : 500,
              backgroundColor: sourceMode === 'url' ? '#ffffff' : 'transparent',
              color: sourceMode === 'url' ? '#000000' : 'rgba(0, 0, 0, 0.55)',
              boxShadow: sourceMode === 'url' ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 120ms ease',
            }}
          >
            Paste URL
          </button>
        </div>

        <span style={{ fontSize: 'var(--text-meta)', color: 'rgba(0, 0, 0, 0.4)', fontWeight: 500 }}>
          Dubbing workspace
        </span>
      </div>

      {/* Large Dropzone / Content Area */}
      {sourceMode === 'upload' ? (
        <div
          className="workspace-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) {
              setSourceError(null);
              setUploadedFile(file);
              setUploadedFileName(file.name);
              setProjectName(file.name.replace(/\.[^/.]+$/, ''));
            }
          }}
          style={{
            backgroundColor: isDragging ? 'rgba(0, 0, 0, 0.03)' : '#F9FAFB',
            border: sourceError ? '1px solid rgba(185, 28, 28, 0.35)' : isDragging ? '1px dashed #000000' : '1px solid rgba(0, 0, 0, 0.04)',
            borderRadius: '12px',
            minHeight: '210px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            marginBottom: '14px',
            transition: 'all 140ms ease',
          }}
        >
          <input
            type="file"
            accept="video/mp4,video/quicktime,video/mov,video/webm,audio/mp3,audio/wav,audio/m4a"
            onChange={handleFileSelect}
            disabled={isGenerating}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              cursor: 'pointer',
            }}
          />

          {isGenerating ? (
            <div aria-live="polite" style={{ textAlign: 'center', position: 'relative', zIndex: 2, width: 'min(320px, 80%)' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px', color: '#111827' }} />
              <p style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: '#111827' }}>Preparing your dubbing project</p>
              <p style={{ fontSize: 'var(--text-body)', color: 'rgba(0, 0, 0, 0.5)', marginTop: '3px' }}>
                {uploadedFileName ? `Uploading ${uploadedFileName}` : 'Connecting to your video source'}
              </p>
              <div className="workspace-upload-progress" aria-hidden="true" />
            </div>
          ) : uploadedFileName ? (
            <div style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0, 0, 0, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px',
                }}
              >
                <CheckCircle2 size={20} color="#16a34a" />
              </div>
              <p style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: '#111827' }}>{uploadedFileName}</p>
              <p style={{ fontSize: 'var(--text-body)', color: 'rgba(0, 0, 0, 0.5)', marginTop: '2px' }}>
                Ready to dub{uploadedFile ? ` • ${formatFileSize(uploadedFile.size)}` : ''}
              </p>
              <button
                type="button"
                onClick={handleClearFile}
                className="btn btn-ghost btn-sm"
                style={{
                  marginTop: '8px',
                  padding: '4px 10px',
                  fontSize: 'var(--text-control)',
                  color: 'rgba(0, 0, 0, 0.6)',
                }}
              >
                <X size={12} style={{ marginRight: '4px' }} />
                Remove file
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', pointerEvents: 'none' }}>
              <button
                type="button"
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid rgba(0, 0, 0, 0.14)',
                  borderRadius: '8px',
                  padding: '7px 16px',
                  fontSize: 'var(--text-control)',
                  fontWeight: 600,
                  color: '#111827',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
              >
                Select files
              </button>
              <span style={{ fontSize: 'var(--text-control)', color: 'rgba(0, 0, 0, 0.45)' }}>
                or drag and drop them here
              </span>
            </div>
          )}
        </div>
      ) : (
        <div
          className="workspace-url-panel"
          style={{
            backgroundColor: '#F9FAFB',
            border: '1px solid rgba(0, 0, 0, 0.04)',
            borderRadius: '12px',
            minHeight: '210px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            marginBottom: '14px',
          }}
        >
          <div style={{ width: '100%', maxWidth: '520px' }}>
            <label
              htmlFor="workspace-media-url"
              style={{
                fontSize: 'var(--text-control)',
                fontWeight: 600,
                color: '#111827',
                marginBottom: '8px',
                display: 'block',
              }}
            >
              Paste a direct video or audio file URL
            </label>
            <div style={{ position: 'relative' }}>
              <LinkIcon
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'rgba(0, 0, 0, 0.4)',
                }}
              />
              <input
                type="url"
                id="workspace-media-url"
                aria-describedby="workspace-media-url-help"
                value={videoUrl}
                onChange={(e) => {
                  setVideoUrl(e.target.value);
                  setSourceError(null);
                }}
                placeholder="https://cdn.example.com/video.mp4"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 0, 0, 0.15)',
                  fontSize: 'var(--text-input)',
                  backgroundColor: '#ffffff',
                  outline: 'none',
                }}
              />
              {videoUrl && (
                <button
                  type="button"
                  onClick={() => setVideoUrl('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: 'rgba(0, 0, 0, 0.4)',
                    padding: '4px',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <p id="workspace-media-url-help" style={{ fontSize: 'var(--text-body)', color: 'rgba(0, 0, 0, 0.45)', marginTop: '6px' }}>
              Use a public media file link, such as .mp4 or .mp3. YouTube, Vimeo, and TikTok page links cannot be imported.
            </p>
          </div>
        </div>
      )}

      {sourceError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            margin: '-4px 0 14px',
            padding: '9px 10px',
            borderRadius: '8px',
            backgroundColor: 'rgba(185, 28, 28, 0.06)',
            color: '#991b1b',
            fontSize: 'var(--text-meta)',
            fontWeight: 500,
          }}
        >
          <AlertCircle size={15} />
          <span>{sourceError}</span>
        </div>
      )}

      {/* Bottom Action Bar inside box: [Language selector] [Advanced] on left, [Arrow submit] on right */}
      <div
        className="workspace-action-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        <div className="workspace-actions-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Target Language Dropdown */}
          <div ref={langDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              className="workspace-language-trigger"
              onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(0, 0, 0, 0.1)',
                backgroundColor: '#ffffff',
                color: '#111827',
                fontSize: 'var(--text-control)',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Globe size={14} color="rgba(0, 0, 0, 0.6)" />
              <span>{getLanguageLabel(targetLanguage)}</span>
              <ChevronDown size={13} color="rgba(0, 0, 0, 0.4)" />
            </button>

            {isLangDropdownOpen && (
              <div
                className="workspace-language-menu"
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  marginBottom: '8px',
                  width: '200px',
                  backgroundColor: '#ffffff',
                  border: '1px solid rgba(0, 0, 0, 0.1)',
                  borderRadius: '10px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
                  padding: '6px',
                  zIndex: 100,
                }}
              >
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => handleLanguageSelect(l.code)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: targetLanguage === l.code ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                      color: '#111827',
                      fontSize: 'var(--text-control)',
                      fontWeight: targetLanguage === l.code ? 600 : 400,
                      cursor: 'pointer',
                    }}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Advanced Settings Button */}
          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: isAdvancedOpen ? 'rgba(0, 0, 0, 0.06)' : 'transparent',
              color: 'rgba(0, 0, 0, 0.7)',
              fontSize: 'var(--text-control)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <SlidersHorizontal size={14} />
            <span>Advanced</span>
          </button>
        </div>

        {/* Submit button */}
        <div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={(!uploadedFileName && !videoUrl) || isGenerating}
            className="workspace-submit-button"
            aria-label={isGenerating ? 'Starting dubbing project' : 'Start dubbing project'}
            style={{
              width: 'auto',
              height: '38px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: uploadedFileName || videoUrl ? '#000000' : 'rgba(0, 0, 0, 0.18)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '0 14px',
              fontSize: 'var(--text-control)',
              fontWeight: 700,
              cursor: (uploadedFileName || videoUrl) && !isGenerating ? 'pointer' : 'not-allowed',
              transition: 'all 140ms ease',
            }}
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.2} />}
            <span>{isGenerating ? 'Starting...' : 'Start dubbing'}</span>
          </button>
        </div>
      </div>

      {/* Advanced Options Drawer */}
      {isAdvancedOpen && (
        <div
          className="workspace-advanced-panel"
          style={{
            marginTop: '14px',
            paddingTop: '14px',
            borderTop: '1px solid rgba(0, 0, 0, 0.06)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px',
            animation: 'fadeIn 120ms ease',
          }}
        >
          <div>
            <label
              style={{
                fontSize: 'var(--text-control)',
                fontWeight: 600,
                color: 'rgba(0, 0, 0, 0.6)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Project Title
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. My Studio Dub"
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                fontSize: 'var(--text-input)',
              }}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: 'var(--text-control)',
                fontWeight: 600,
                color: 'rgba(0, 0, 0, 0.6)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Voice Profile
            </label>
            <select
              value={selectedVoiceId}
              onChange={(e) => setSelectedVoiceId(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                fontSize: 'var(--text-input)',
                backgroundColor: '#fff',
              }}
            >
              {voices.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.language} {v.gender})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                fontSize: 'var(--text-control)',
                fontWeight: 600,
                color: 'rgba(0, 0, 0, 0.6)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Speech Cadence
            </label>
            <select
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(0, 0, 0, 0.12)',
                fontSize: 'var(--text-input)',
                backgroundColor: '#fff',
              }}
            >
              <option>Dynamic Lip Sync (Natural)</option>
              <option>Fast Cadence (Shorts/TikTok)</option>
              <option>Narrative Pacing (Documentary)</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};
