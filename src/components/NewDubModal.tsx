import React, { useState, useRef } from 'react';
import { useDialogFocus } from '../hooks/useDialogFocus';
import type { Project } from '../types';
import { UploadCloud, Link as LinkIcon, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { checkMinutesBeforeUpload, checkUploadedMediaMinutes } from '../utils/dubbingMinutes';

interface NewDubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: Project) => void | Promise<void>;
}

export const NewDubModal: React.FC<NewDubModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
}) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [projectName, setProjectName] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('uz');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ isOpen, dialogRef, onClose, canClose: !isSubmitting });

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setProjectName(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !projectName.trim() || (!videoUrl.trim() && !selectedFile)) return;
    setErrorMessage('');
    setIsSubmitting(true);
    let mediaId: string | undefined;
    let projectCreated = false;

    try {
      await checkMinutesBeforeUpload(selectedFile);
      let finalMediaUrl = videoUrl;

      // 1. Upload to backend if file exists
      if (selectedFile) {
        try {
          const uploadRes = await api.media.upload(selectedFile);
          finalMediaUrl = uploadRes.url;
          mediaId = uploadRes.id || uploadRes.mediaId;
        } catch {
          throw new Error('Could not upload your video. Please try again.');
        }
      } else {
        try {
          const imported = await api.media.importUrl(videoUrl);
          finalMediaUrl = imported.url;
          mediaId = imported.id || imported.mediaId;
        } catch (error) {
          throw new Error(error instanceof Error
            ? error.message
            : 'Could not import this media URL. Use a public direct media file link or upload a file.');
        }
      }

      if (!mediaId) throw new Error('Media upload did not return an ID. Please try again.');
      const duration = await checkUploadedMediaMinutes(mediaId);

      // 2. Imported media is transcribed asynchronously after the project exists,
      // allowing the persisted job to be restored by project id after refresh.
      const transcript: Project['transcript'] = [];

      const newProj: Project = {
        id: `proj-${Date.now()}`,
        title: projectName || 'New Project Dub',
        originalLanguage: 'en',
        targetLanguage,
        status: 'draft',
        duration,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        videoUrl: finalMediaUrl,
        mediaId,
        thumbnailUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
        voiceId: targetLanguage === 'uz' ? 'voice-farrux' : 'voice-elena',
        transcript,
      };

      await onCreateProject(newProj);
      projectCreated = true;

      if (mediaId) {
        try {
          await api.dubbing.transcribe({
            mediaId,
            projectId: newProj.id,
            language: 'en',
          });
        } catch (err) {
          console.warn('Could not queue project transcription:', err);
        }
      }
      onClose();
    } catch (error) {
      if (mediaId && !projectCreated) {
        try { await api.media.delete(mediaId); } catch (cleanupError) {
          console.warn('Could not remove unused media after minute check:', cleanupError);
        }
      }
      setErrorMessage(error instanceof Error ? error.message : 'Could not create your project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={() => { if (!isSubmitting) onClose(); }}>
      <div
        className="modal-container"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-dub-title"
        tabIndex={-1}
        style={{ maxWidth: '580px' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 id="new-dub-title" style={{ fontSize: '18px', fontWeight: 700 }}>Create a new dub</h3>
            <p style={{ fontSize: 'var(--text-body)', color: 'var(--black-60)', marginTop: '2px' }}>
              Upload your video to start dubbing in 30+ languages
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close new project dialog"
            disabled={isSubmitting}
            className="btn-ghost"
            style={{ padding: '6px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">

            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file && !isSubmitting) {
                  setSelectedFile(file);
                  setProjectName(file.name.replace(/\.[^/.]+$/, ''));
                }
              }}
              style={{
                border: isDragging ? '2px dashed var(--black-100)' : '1px dashed var(--black-20)',
                backgroundColor: isDragging ? 'var(--black-05)' : 'var(--c-white)',
                borderRadius: 'var(--radius-md)',
                padding: '32px 20px',
                textAlign: 'center',
                marginBottom: '20px',
                position: 'relative',
                transition: 'all var(--transition-fast)',
              }}
            >
              <input
                type="file"
                aria-label="Choose video file"
                disabled={isSubmitting}
                accept="video/mp4,video/quicktime,video/mov"
                onChange={handleFileUpload}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'pointer',
                }}
              />
              <UploadCloud size={32} style={{ margin: '0 auto 12px', display: 'block', color: 'var(--black-60)' }} />
              <p style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--black-100)', marginBottom: '4px' }}>
                Drag and drop a video here
              </p>
              <p style={{ fontSize: 'var(--text-body)', color: 'var(--black-60)', marginBottom: '12px' }}>
                or <span style={{ textDecoration: 'underline', fontWeight: 500, color: 'var(--black-100)' }}>browse files</span> from your device
              </p>
              <p style={{ fontSize: 'var(--text-body)', color: 'var(--black-40)' }}>
                Supported formats: MP4, MOV • Video length depends on your remaining dubbing minutes
              </p>

              {selectedFile && (
                <div aria-live="polite" style={{ marginTop: '16px' }}>
                  {isSubmitting && <div className="new-dub-uploading-indicator" aria-hidden="true" />}
                  <div style={{ fontSize: 'var(--text-meta)', color: 'var(--black-60)', marginTop: '4px' }}>
                    {isSubmitting ? 'Uploading and preparing your video…' : `${selectedFile.name} selected — ready to upload`}
                  </div>
                  {!isSubmitting && <button type="button" className="btn btn-secondary btn-sm" style={{ position: 'relative', marginTop: '8px' }} onClick={() => setSelectedFile(null)}>Remove selected file</button>}
                </div>
              )}
            </div>

            {/* URL Input */}
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="new-dub-url" className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <LinkIcon size={12} />
                Or paste a direct video or audio file URL
              </label>
              <input
                type="url"
                id="new-dub-url"
                aria-describedby="new-dub-url-help"
                disabled={isSubmitting || !!selectedFile}
                className="input"
                placeholder="https://cdn.example.com/video.mp4"
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
              />
              <p id="new-dub-url-help" style={{ fontSize: 'var(--text-body)', color: 'var(--black-60)', marginTop: '6px' }}>
                Use a public file link, such as .mp4 or .mp3. Video page links cannot be imported.
              </p>
            </div>

            {/* Project Details */}
            <div className="new-dub-details" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '14px' }}>
              <div>
                <label htmlFor="new-dub-name" className="label">Project name</label>
                <input
                  type="text"
                  id="new-dub-name"
                  disabled={isSubmitting}
                  className="input"
                  placeholder="e.g. Product Keynote 2026"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="new-dub-language" className="label">Target language</label>
                <select
                  id="new-dub-language"
                  disabled={isSubmitting}
                  className="select"
                  value={targetLanguage}
                  onChange={e => setTargetLanguage(e.target.value)}
                >
                  <option value="uz">Uzbek (O'zbek)</option>
                  <option value="es">Spanish (Español)</option>
                  <option value="de">German (Deutsch)</option>
                  <option value="fr">French (Français)</option>
                  <option value="ja">Japanese (日本語)</option>
                  <option value="en">English (US)</option>
                </select>
              </div>
            </div>
          </div>

          {errorMessage && <p role="alert" style={{ padding: '0 24px 16px', color: 'var(--black-80)' }}>{errorMessage}</p>}
          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!projectName.trim() || (!videoUrl.trim() && !selectedFile) || isSubmitting}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Entering Studio...
                </>
              ) : (
                'Enter Studio'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
