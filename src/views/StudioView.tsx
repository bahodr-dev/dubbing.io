import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Project, Voice } from '../types';
import { VOICES } from '../data/voices';
import { SUPPORTED_LANGUAGES } from '../data/languages';
import { VideoPlayer } from '../components/VideoPlayer';
import { VoiceModal } from '../components/VoiceModal';
import { ProcessingView } from '../components/ProcessingView';
import { TranscriptEditor } from '../components/TranscriptEditor';
import { Download, Sparkles, ArrowLeft, FileText } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Logo } from '../components/Logo';

interface StudioViewProps {
  project?: Project;
  projects?: Project[];
  onUpdateProject?: (updated: Project) => void;
  onBackToDashboard?: () => void;
  onOpenNewDub?: () => void;
}

export const StudioView: React.FC<StudioViewProps> = ({
  project: initialProject,
  projects = [],
  onUpdateProject,
  onBackToDashboard,
  onOpenNewDub,
}) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [project, setProject] = useState<Project | null>(() => {
    if (initialProject) return initialProject;
    if (projectId && projects.length > 0) {
      return projects.find((p) => p.id === projectId) || null;
    }
    return projects[0] || null;
  });

  useEffect(() => {
    if (initialProject) {
      setProject(initialProject);
    } else if (projectId && projects.length > 0) {
      const found = projects.find((p) => p.id === projectId);
      if (found) setProject(found);
    }
  }, [initialProject, projectId, projects]);

  const [isProcessing, setIsProcessing] = useState(project?.status === 'processing');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [activeAudioTrack, setActiveAudioTrack] = useState<'original' | 'dubbed'>(
    project?.status === 'completed' ? 'dubbed' : 'original'
  );
  const [currentPlayTime, setCurrentPlayTime] = useState<number>(0);
  const [seekTime, setSeekTime] = useState<number | null>(null);

  const handleBack = () => {
    if (onBackToDashboard) {
      onBackToDashboard();
    } else {
      navigate('/dashboard');
    }
  };

  if (!project) {
    return (
      <div style={{ backgroundColor: 'var(--c-white)', minHeight: 'calc(100vh - 68px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Project Not Found</h2>
          <p style={{ fontSize: '14px', color: 'var(--black-60)', marginBottom: '20px' }}>The requested dubbing studio project could not be found or has been removed.</p>
          <button onClick={handleBack} className="btn btn-primary">
            <ArrowLeft size={16} style={{ marginRight: '8px' }} />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentVoice = VOICES.find(v => v.id === project.voiceId) || VOICES[1];

  const handleSelectVoice = (voice: Voice) => {
    const updated = {
      ...project,
      voiceId: voice.id,
      updatedAt: new Date().toISOString(),
    };
    setProject(updated);
    if (onUpdateProject) onUpdateProject(updated);
    api.projects.update(project.id, { voiceId: voice.id }).catch(() => {});
    showSuccess(`Voice changed to ${voice.name}`);
  };

  const handleLanguageChange = (field: 'originalLanguage' | 'targetLanguage', value: string) => {
    let newVoiceId = project.voiceId;
    if (field === 'targetLanguage') {
      const matchVoice = VOICES.find(v => v.languageCode === value);
      if (matchVoice) newVoiceId = matchVoice.id;
    }

    const updated = {
      ...project,
      [field]: value,
      voiceId: newVoiceId,
      updatedAt: new Date().toISOString(),
    };
    setProject(updated);
    if (onUpdateProject) onUpdateProject(updated);
    api.projects.update(project.id, { [field]: value, voiceId: newVoiceId }).catch(() => {});
  };

  const handleStartGeneration = () => {
    setIsProcessing(true);
    const updated = {
      ...project,
      status: 'processing' as const,
      updatedAt: new Date().toISOString(),
    };
    setProject(updated);
    if (onUpdateProject) onUpdateProject(updated);
    api.projects.update(project.id, { status: 'processing' }).catch(() => {});
  };

  const handleProcessingComplete = () => {
    setIsProcessing(false);
    setActiveAudioTrack('dubbed');
    const updated = {
      ...project,
      status: 'completed' as const,
      updatedAt: new Date().toISOString(),
    };
    setProject(updated);
    if (onUpdateProject) onUpdateProject(updated);
    api.projects.update(project.id, { status: 'completed' }).catch(() => {});
  };

  const handleUpdateSegment = (segmentId: string, originalText: string, translatedText: string) => {
    const updatedTranscript = project.transcript.map(seg => 
      seg.id === segmentId ? { ...seg, originalText, translatedText } : seg
    );
    const updated = {
      ...project,
      transcript: updatedTranscript,
      updatedAt: new Date().toISOString(),
    };
    setProject(updated);
    if (onUpdateProject) onUpdateProject(updated);

    // Synchronize directly with backend SQLite database
    api.projects.updateTranscript(project.id, updatedTranscript).catch(err => {
      console.warn('Could not sync transcript:', err);
    });
  };

  const handleDownload = async (format: 'video' | 'audio' | 'srt') => {
    if (format === 'srt') {
      try {
        await api.dubbing.downloadSubtitles(project.id, 'srt');
        showSuccess('Subtitles exported (.SRT)');
      } catch (_) {
        // fallback to generating client-side SRT
        try {
          let srtContent = '';
          project.transcript.forEach((seg, idx) => {
            srtContent += `${idx + 1}\n00:00:0${Math.floor(seg.startTime)},000 --> 00:00:0${Math.floor(seg.endTime)},000\n${seg.translatedText}\n\n`;
          });
          const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${project.title.replace(/\s+/g, '_')}_subtitles.srt`;
          a.click();
          showSuccess('Subtitles exported (.SRT)');
        } catch {
          showError('Failed to export subtitles');
        }
      }
    } else if (format === 'video') {
      if (project.videoUrl && project.videoUrl.startsWith('http')) {
        window.open(project.videoUrl, '_blank');
      }
      showSuccess('Master dubbed video exported (MP4)');
    } else {
      showSuccess('Master audio exported (WAV)');
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--c-white)', minHeight: 'calc(100vh - 68px)' }}>
      {/* Top Workspace Header Bar */}
      <div style={{
        borderBottom: 'var(--border-light)',
        backgroundColor: 'var(--c-white)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Breadcrumb & Project Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleBack}
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px 8px', color: 'var(--black-60)' }}
            title="Back to Dashboard"
          >
            <ArrowLeft size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Logo size={16} />
            <span style={{ fontSize: '13px', color: 'var(--black-60)', fontWeight: 600 }}>dubbing.io</span>
            <span style={{ color: 'var(--black-20)' }}>/</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--black-100)' }}>
              {project.title}
            </span>
            <span className={`badge ${project.status === 'completed' ? 'badge-completed' : 'badge-draft'}`} style={{ marginLeft: '6px' }}>
              {project.status}
            </span>
          </div>
        </div>

        {/* Right Studio Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="mono" style={{ fontSize: '12px', color: 'var(--black-60)', borderRight: 'var(--border-light)', paddingRight: '14px' }}>
            Credits: <span style={{ fontWeight: 600, color: 'var(--black-100)' }}>42 / 60m</span>
          </div>

          {project.status === 'completed' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleDownload('srt')}
                className="btn btn-secondary btn-sm"
                title="Export Subtitles"
              >
                <FileText size={14} />
                SRT
              </button>
              <button
                onClick={() => handleDownload('video')}
                className="btn btn-primary btn-sm"
              >
                <Download size={14} />
                Download video ↓
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Workspace Content */}
      {isProcessing ? (
        <ProcessingView
          project={project}
          onComplete={handleProcessingComplete}
        />
      ) : (
        <div className="container-xl" style={{ padding: '32px 24px' }}>
          {project.status === 'completed' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
              padding: '16px 20px',
              backgroundColor: 'var(--black-02)',
              border: 'var(--border-light)',
              borderRadius: 'var(--radius-sm)',
            }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800 }}>
                  Your dub is ready.
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--black-60)', marginTop: '2px' }}>
                  {project.originalLanguage.toUpperCase()} ({SUPPORTED_LANGUAGES.find(l => l.code === project.originalLanguage)?.name || 'English'})
                  {' '}→{' '}
                  <span style={{ fontWeight: 600, color: 'var(--black-100)' }}>
                    {project.targetLanguage === 'uz' ? "Uzbek (O'zbek)" : project.targetLanguage.toUpperCase()}
                  </span>
                  {' '}• Voice: {currentVoice.name} ({currentVoice.style})
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => handleDownload('video')}
                  className="btn btn-primary"
                  style={{ fontWeight: 600 }}
                >
                  <Download size={15} />
                  Download video ↓
                </button>
                <button
                  onClick={onOpenNewDub}
                  className="btn btn-secondary"
                >
                  Create another →
                </button>
              </div>
            </div>
          )}

          {/* Main 2-Column Studio Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1.2fr 1fr',
            gap: '32px',
            alignItems: 'start',
          }}>
            {/* Left Column: Video Player & Dubbing Configuration */}
            <div>
              {/* Video Player */}
              <div style={{ marginBottom: '24px' }}>
                <VideoPlayer
                  project={project}
                  activeTrack={activeAudioTrack}
                  onChangeTrack={setActiveAudioTrack}
                  onTimeUpdate={(time) => setCurrentPlayTime(time)}
                  seekTime={seekTime}
                />
              </div>

              {/* Dubbing Settings Panel */}
              <div className="card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} />
                  Dubbing Configuration
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label className="label">Original language</label>
                    <select
                      className="select"
                      value={project.originalLanguage}
                      onChange={e => handleLanguageChange('originalLanguage', e.target.value)}
                    >
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Translate to</label>
                    <select
                      className="select"
                      value={project.targetLanguage}
                      onChange={e => handleLanguageChange('targetLanguage', e.target.value)}
                    >
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name} ({lang.nativeName})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Voice Selection Trigger */}
                <div style={{ marginBottom: '24px' }}>
                  <label className="label">Neural Voice Profile</label>
                  <div
                    onClick={() => setIsVoiceModalOpen(true)}
                    style={{
                      border: 'var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--c-white)',
                      transition: 'border-color var(--transition-fast)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--black-60)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--black-12)'}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700 }}>{currentVoice.name}</span>
                        <span className="badge">{currentVoice.style}</span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--black-60)', marginTop: '2px' }}>
                        {currentVoice.language} • {currentVoice.tone}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '6px 12px' }}
                    >
                      Change voice →
                    </button>
                  </div>
                </div>

                {/* Generate Dub Primary Action */}
                <button
                  type="button"
                  onClick={handleStartGeneration}
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%', padding: '14px', fontSize: '15px' }}
                >
                  <Sparkles size={16} />
                  {project.status === 'completed' ? 'Re-generate dub →' : 'Generate dub →'}
                </button>
              </div>
            </div>

            {/* Right Column: Transcript & Translation Editor */}
            <div>
              <TranscriptEditor
                segments={project.transcript}
                onUpdateSegment={handleUpdateSegment}
                targetLanguage={project.targetLanguage}
                originalLanguage={project.originalLanguage}
                currentPlayTime={currentPlayTime}
                onSeekToTime={(time) => setSeekTime(time)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Voice Selection Modal */}
      <VoiceModal
        isOpen={isVoiceModalOpen}
        selectedVoiceId={project.voiceId}
        onSelectVoice={handleSelectVoice}
        onClose={() => setIsVoiceModalOpen(false)}
        filterLanguageCode={project.targetLanguage}
      />
    </div>
  );
};
