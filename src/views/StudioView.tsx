import React, { useState } from 'react';
import type { Project, Voice } from '../types';
import { VOICES } from '../data/voices';
import { SUPPORTED_LANGUAGES } from '../data/languages';
import { VideoPlayer } from '../components/VideoPlayer';
import { VoiceModal } from '../components/VoiceModal';
import { ProcessingView } from '../components/ProcessingView';
import { TranscriptEditor } from '../components/TranscriptEditor';
import { Download, Sparkles, ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';

interface StudioViewProps {
  project: Project;
  onUpdateProject: (updated: Project) => void;
  onBackToDashboard: () => void;
  onOpenNewDub: () => void;
}

export const StudioView: React.FC<StudioViewProps> = ({
  project,
  onUpdateProject,
  onBackToDashboard,
  onOpenNewDub,
}) => {
  const [isProcessing, setIsProcessing] = useState(project.status === 'processing');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [activeAudioTrack, setActiveAudioTrack] = useState<'original' | 'dubbed'>(
    project.status === 'completed' ? 'dubbed' : 'original'
  );
  const [showExportToast, setShowExportToast] = useState<string | null>(null);

  const currentVoice = VOICES.find(v => v.id === project.voiceId) || VOICES[1];

  const handleSelectVoice = (voice: Voice) => {
    onUpdateProject({
      ...project,
      voiceId: voice.id,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleLanguageChange = (field: 'originalLanguage' | 'targetLanguage', value: string) => {
    // If setting target to uz, default voice to farrux, if es -> elena, etc.
    let newVoiceId = project.voiceId;
    if (field === 'targetLanguage') {
      const matchVoice = VOICES.find(v => v.languageCode === value);
      if (matchVoice) newVoiceId = matchVoice.id;
    }

    onUpdateProject({
      ...project,
      [field]: value,
      voiceId: newVoiceId,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleStartGeneration = () => {
    setIsProcessing(true);
    onUpdateProject({
      ...project,
      status: 'processing',
      updatedAt: new Date().toISOString(),
    });
  };

  const handleProcessingComplete = () => {
    setIsProcessing(false);
    setActiveAudioTrack('dubbed');
    onUpdateProject({
      ...project,
      status: 'completed',
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateSegment = (segmentId: string, originalText: string, translatedText: string) => {
    const updatedTranscript = project.transcript.map(seg => 
      seg.id === segmentId ? { ...seg, originalText, translatedText } : seg
    );
    onUpdateProject({
      ...project,
      transcript: updatedTranscript,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDownload = (format: 'video' | 'audio' | 'srt') => {
    let msg = 'Downloading master dubbed video (MP4)...';
    if (format === 'audio') msg = 'Downloading isolated dubbed audio (WAV 44.1kHz)...';
    if (format === 'srt') msg = 'Downloading synchronized subtitles (.SRT)...';

    setShowExportToast(msg);
    setTimeout(() => {
      setShowExportToast(null);
    }, 3000);
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
            onClick={onBackToDashboard}
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px 8px', color: 'var(--black-60)' }}
            title="Back to Dashboard"
          >
            <ArrowLeft size={16} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--black-40)' }}>dubbing.io</span>
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

      {/* Export Toast Notification */}
      {showExportToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: 'var(--black-100)',
          color: 'var(--white-100)',
          padding: '12px 20px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 1000,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
          animation: 'fadeIn 150ms ease',
        }}>
          <CheckCircle2 size={16} color="#ffffff" />
          {showExportToast}
        </div>
      )}

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
