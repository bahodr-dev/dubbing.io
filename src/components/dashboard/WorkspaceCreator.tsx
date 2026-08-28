import React, { useState, useRef, useEffect } from 'react';
import type { Project, Voice } from '../../types';
import { api } from '../../services/api';
import {
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
  onProjectCreated: (project: Project) => void;
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
      setUploadedFile(file);
      setUploadedFileName(file.name);
      setProjectName(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSubmit = async () => {
    if (!uploadedFileName && !videoUrl) return;

    setIsGenerating(true);
    const title =
      projectName ||
      (uploadedFileName ? uploadedFileName.replace(/\.[^/.]+$/, '') : 'Online Video Dub');

    try {
      let finalMediaUrl = videoUrl;

      // 1. If file was selected, upload directly to backend
      if (uploadedFile) {
        try {
          const uploadRes = await api.media.upload(uploadedFile);
          finalMediaUrl = uploadRes.url;
        } catch (uploadErr: any) {
          console.warn('Media upload fallback:', uploadErr);
          if (onShowToast) {
            onShowToast(uploadErr.message || 'Media upload error', 'error');
          }
        }
      }

      // 2. Generate AI dubbing transcript timeline
      let generatedTranscript: any[] = [];
      try {
        const dubbingRes = await api.dubbing.generate({
          targetLanguage,
          duration: 30,
          title,
        });
        if (dubbingRes.transcript && dubbingRes.transcript.length > 0) {
          generatedTranscript = dubbingRes.transcript;
        }
      } catch (genErr) {
        console.warn('Dubbing timeline generated fallback:', genErr);
      }

      const newProj: Project = {
        id: `proj-${Date.now()}`,
        title: title,
        originalLanguage: 'en',
        targetLanguage: targetLanguage,
        status: 'draft',
        duration: 30,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        videoUrl: finalMediaUrl,
        thumbnailUrl:
          'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
        voiceId: selectedVoiceId || (targetLanguage === 'uz' ? 'voice-farrux' : 'voice-elena'),
        transcript: generatedTranscript,
      };

      onProjectCreated(newProj);
      if (onShowToast) {
        onShowToast('Dubbing project created successfully!', 'success');
      }
    } catch (err: any) {
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
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <div
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
            onClick={() => setSourceMode('upload')}
            style={{
              border: 'none',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: '13px',
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
            onClick={() => setSourceMode('url')}
            style={{
              border: 'none',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: '13px',
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

        <span style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.4)', fontWeight: 500 }}>
          Dubbing workspace
        </span>
      </div>

      {/* Large Dropzone / Content Area */}
      {sourceMode === 'upload' ? (
        <div
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
              setUploadedFile(file);
              setUploadedFileName(file.name);
              setProjectName(file.name.replace(/\.[^/.]+$/, ''));
            }
          }}
          style={{
            backgroundColor: isDragging ? 'rgba(0, 0, 0, 0.03)' : '#F9FAFB',
            border: isDragging ? '1px dashed #000000' : '1px solid rgba(0, 0, 0, 0.04)',
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
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0,
              cursor: 'pointer',
            }}
          />

          {uploadedFileName ? (
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
              <p style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{uploadedFileName}</p>
              <p style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.5)', marginTop: '2px' }}>
                File ready for dubbing
              </p>
              <button
                type="button"
                onClick={handleClearFile}
                className="btn btn-ghost btn-sm"
                style={{
                  marginTop: '8px',
                  padding: '4px 10px',
                  fontSize: '11.5px',
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
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#111827',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
              >
                Select files
              </button>
              <span style={{ fontSize: '13px', color: 'rgba(0, 0, 0, 0.45)' }}>
                or drag and drop them here
              </span>
            </div>
          )}
        </div>
      ) : (
        <div
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
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#111827',
                marginBottom: '8px',
                display: 'block',
              }}
            >
              Paste video or audio URL
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
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or direct MP4"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 38px',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 0, 0, 0.15)',
                  fontSize: '13.5px',
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
            <p style={{ fontSize: '11.5px', color: 'rgba(0, 0, 0, 0.45)', marginTop: '6px' }}>
              Supports YouTube, Vimeo, TikTok, or direct .mp4/.mp3 links
            </p>
          </div>
        </div>
      )}

      {/* Bottom Action Bar inside box: [Language selector] [Advanced] on left, [Arrow submit] on right */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Target Language Dropdown */}
          <div ref={langDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
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
                fontSize: '13px',
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
                      fontSize: '12.5px',
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
              fontSize: '13px',
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
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: uploadedFileName || videoUrl ? '#000000' : 'rgba(0, 0, 0, 0.18)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: (uploadedFileName || videoUrl) && !isGenerating ? 'pointer' : 'not-allowed',
              transition: 'all 140ms ease',
            }}
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} strokeWidth={2.2} />}
          </button>
        </div>
      </div>

      {/* Advanced Options Drawer */}
      {isAdvancedOpen && (
        <div
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
                fontSize: '11.5px',
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
                fontSize: '12.5px',
              }}
            />
          </div>
          <div>
            <label
              style={{
                fontSize: '11.5px',
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
                fontSize: '12.5px',
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
                fontSize: '11.5px',
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
                fontSize: '12.5px',
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
