import React, { useState } from 'react';
import type { Project } from '../types';
import { INITIAL_PROJECTS } from '../data/sampleProjects';
import { UploadCloud, Link as LinkIcon } from 'lucide-react';

interface NewDubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: Project) => void;
}

export const NewDubModal: React.FC<NewDubModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
}) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [projectName, setProjectName] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('uz');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProjectName(file.name.replace(/\.[^/.]+$/, ''));
      setUploadProgress(10);
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev === null || prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 30;
        });
      }, 150);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newProj: Project = {
      id: `proj-${Date.now()}`,
      title: projectName || 'New Project Dub',
      originalLanguage: 'en',
      targetLanguage,
      status: 'draft',
      duration: 24.5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      videoUrl: videoUrl,
      thumbnailUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80',
      voiceId: targetLanguage === 'uz' ? 'voice-farrux' : 'voice-elena',
      transcript: INITIAL_PROJECTS[0].transcript,
    };

    onCreateProject(newProj);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-container" 
        style={{ maxWidth: '580px' }} 
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Create a new dub</h3>
            <p style={{ fontSize: '13px', color: 'var(--black-60)', marginTop: '2px' }}>
              Upload your video to start dubbing in 30+ languages
            </p>
          </div>
          <button 
            onClick={onClose} 
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
                if (file) {
                  setProjectName(file.name.replace(/\.[^/.]+$/, ''));
                  setUploadProgress(100);
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
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--black-100)', marginBottom: '4px' }}>
                Drag and drop a video here
              </p>
              <p style={{ fontSize: '12px', color: 'var(--black-60)', marginBottom: '12px' }}>
                or <span style={{ textDecoration: 'underline', fontWeight: 500, color: 'var(--black-100)' }}>browse files</span> from your device
              </p>
              <p style={{ fontSize: '11px', color: 'var(--black-40)' }}>
                Supported formats: MP4, MOV • Max duration: 30 seconds
              </p>

              {uploadProgress !== null && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ height: '4px', backgroundColor: 'var(--black-10)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${uploadProgress}%`, backgroundColor: 'var(--black-100)', transition: 'width 200ms ease' }}></div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--black-60)', marginTop: '4px' }}>
                    {uploadProgress < 100 ? `Uploading video... ${uploadProgress}%` : '✓ Video uploaded successfully'}
                  </div>
                </div>
              )}
            </div>

            {/* URL Input */}
            <div style={{ marginBottom: '20px' }}>
              <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <LinkIcon size={12} />
                Or paste a video URL
              </label>
              <input
                type="url"
                className="input"
                placeholder="https://youtube.com/watch?v=... or direct MP4 link"
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
              />
            </div>

            {/* Project Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '14px' }}>
              <div>
                <label className="label">Project name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Product Keynote 2026"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Target language</label>
                <select
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

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!projectName && !videoUrl}
            >
              Enter Studio →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
