import { FilmPanel } from '../components/FilmPanel';
import { QualityModeField } from '../components/QualityModeField';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Project, Voice, SpeechCadence } from '../types';
import { SpeechCadenceField } from '../components/SpeechCadenceField';
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
import { truncateProjectTitle } from '../utils/formatters';

interface StudioViewProps {
  project?: Project;
  projects?: Project[];
  onUpdateProject?: (updated: Project) => void;
  onSettingsSaved?: (projectId: string, patch: Partial<Project>) => void;
  onBackToDashboard?: () => void;
  onOpenNewDub?: () => void;
  onMinutesBalanceChange?: (minutesBalance: number) => void;
}

const formatSrtTime = (seconds: number): string => {
  const totalMilliseconds = Math.round(Math.max(0, Number.isFinite(seconds) ? seconds : 0) * 1000);
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const remainingSeconds = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
};

export const StudioView: React.FC<StudioViewProps> = ({
  project: initialProject,
  projects = [],
  onUpdateProject,
  onSettingsSaved,
  onBackToDashboard,
  onOpenNewDub,
  onMinutesBalanceChange,
}) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const targetProject = initialProject || (projectId && projects.length > 0 ? projects.find((p) => p.id === projectId) || null : projects[0] || null);
  const [project, setProject] = useState<Project | null>(targetProject);
  const [prevTargetId, setPrevTargetId] = useState(targetProject?.id);

  if (targetProject && targetProject.id !== prevTargetId) {
    setPrevTargetId(targetProject.id);
    setProject(targetProject);
  }

  const [isProcessing, setIsProcessing] = useState(project?.status === 'processing' && project?.qualityMode !== 'cinema');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [currentTranscriptionJobId, setCurrentTranscriptionJobId] = useState<string | null>(null);
  const [transcriptionPollVersion, setTranscriptionPollVersion] = useState(0);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [targetSpeakerForVoiceModal, setTargetSpeakerForVoiceModal] = useState<string | null>(null);
  const [activeAudioTrack, setActiveAudioTrack] = useState<'original' | 'dubbed'>(
    project?.status === 'completed' ? 'dubbed' : 'original'
  );
  const [currentPlayTime, setCurrentPlayTime] = useState<number>(0);
  const [seekTime, setSeekTime] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [canRenderFinalDub, setCanRenderFinalDub] = useState<boolean | null>(null);
  const [canCloneVoices, setCanCloneVoices] = useState<boolean | null>(null);
  const [autoCloneVoices, setAutoCloneVoices] = useState(true);
  const [qualityMode, setQualityMode] = useState<'standard' | 'cinema'>(project?.qualityMode || 'standard');
  const [speechCadence, setSpeechCadence] = useState<SpeechCadence | null>(null);
  const [renderableVoiceIds, setRenderableVoiceIds] = useState<string[] | null>(null);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);

  const isStartingProcessRef = useRef(false);
  const settingsSaveInFlightRef = useRef(false);
  const onUpdateProjectRef = useRef(onUpdateProject);

  useEffect(() => {
    onUpdateProjectRef.current = onUpdateProject;
  }, [onUpdateProject]);

  useEffect(() => {
    if (!project?.id || project.status !== 'completed') return;
    let cancelled = false;
    api.dubbing.getLatestProjectJob(project.id).then(({ job }) => {
      if (!cancelled) {
        setAutoCloneVoices(job.autoCloneVoices === true);
        setSpeechCadence(job.speechCadence || 'natural');
        setQualityMode(job.qualityMode || 'standard');
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [project?.id, project?.status]);

  useEffect(() => {
    let cancelled = false;
    api.dubbing.getCapabilities()
      .then((capabilities) => {
        if (!cancelled) {
          setCanRenderFinalDub(capabilities.canRenderFinalDub);
          setCanCloneVoices(capabilities.canCloneVoices);
          if (Array.isArray(capabilities.renderableVoiceIds)) {
            setRenderableVoiceIds(capabilities.renderableVoiceIds);
          }
        }
      })
      .catch(() => {
        // The server still validates at process-start; do not hide the action
        // merely because an optional capability check could not be read.
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (project?.status !== 'processing' || currentJobId || project.qualityMode === 'cinema') return;

    let cancelled = false;
    api.dubbing.getLatestProjectJob(project.id)
      .then((response) => {
        if (!cancelled && response?.jobId) {
          setCurrentJobId(response.jobId);
          setQualityMode(response.job?.qualityMode || 'standard');
          setIsProcessing(true);
        }
      })
      .catch(() => {
        // A project may briefly be marked processing before its job row is
        // created. The normal start flow supplies the id once it exists.
      });

    return () => {
      cancelled = true;
    };
  }, [project?.id, project?.status, project?.qualityMode, currentJobId]);

  useEffect(() => {
    if (!project?.id || project.transcript.length > 0) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lookupAttempts = 0;

    const pollTranscription = async () => {
      if (cancelled) return;
      try {
        const response = await api.dubbing.getLatestProjectTranscriptionJob(project.id);
        if (cancelled) return;
        const transcriptionJob = response.job;
        setCurrentTranscriptionJobId(response.jobId);

        if (transcriptionJob.status === 'completed' && Array.isArray(transcriptionJob.result?.segments)) {
          const segments = transcriptionJob.result.segments;
          const detectedDuration = transcriptionJob.result.duration;
          setProject((current) => {
            if (!current) return current;
            const updated = {
              ...current,
              transcript: segments,
              duration: detectedDuration || current.duration,
              updatedAt: new Date().toISOString(),
            };
            onUpdateProjectRef.current?.(updated);
            return updated;
          });
          setSaveStatus('saved');
          return;
        }

        if (transcriptionJob.status === 'failed') {
          setSaveStatus('error');
          showError(transcriptionJob.error || 'Video transcription failed.');
          return;
        }

        setSaveStatus('saving');
        timer = setTimeout(pollTranscription, 1500);
      } catch {
        lookupAttempts += 1;
        if (!cancelled && lookupAttempts < 8) {
          timer = setTimeout(pollTranscription, 1000);
        }
      }
    };

    pollTranscription();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [project?.id, project?.transcript.length, showError, transcriptionPollVersion]);

  const handleRetryTranscription = async () => {
    if (!currentTranscriptionJobId) return;
    try {
      await api.dubbing.retryTranscriptionJob(currentTranscriptionJobId);
      setSaveStatus('saving');
      setTranscriptionPollVersion((version) => version + 1);
      showSuccess('Transcription retry started.');
    } catch (err: any) {
      showError(err.message || 'Failed to retry transcription.');
    }
  };

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
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--black-60)', marginBottom: '20px' }}>The requested dubbing studio project could not be found or has been removed.</p>
          <button onClick={handleBack} className="btn btn-primary">
            <ArrowLeft size={16} style={{ marginRight: '8px' }} />
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentVoice = VOICES.find(v => v.id === project.voiceId) || VOICES[1];

  const saveSettings = async (patch: Partial<Project>, successMessage: string) => {
    if (settingsSaveInFlightRef.current) return;
    settingsSaveInFlightRef.current = true;
    setIsSettingsSaving(true);
    try {
      await api.projects.update(project.id, patch);
      const savedPatch = { ...patch, updatedAt: new Date().toISOString() };
      setProject((current) => current?.id === project.id ? { ...current, ...savedPatch } : current);
      onSettingsSaved?.(project.id, savedPatch);
      showSuccess(successMessage);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Could not save studio settings.');
    } finally {
      settingsSaveInFlightRef.current = false;
      setIsSettingsSaving(false);
    }
  };

  const handleSelectVoice = (voice: Voice) => {
    if (targetSpeakerForVoiceModal) {
      const updatedSpeakerVoices = {
        ...(project.speakerVoices || {}),
        [targetSpeakerForVoiceModal]: voice.id,
      };
      void saveSettings(
        { speakerVoices: updatedSpeakerVoices },
        `Voice for ${targetSpeakerForVoiceModal} set to ${voice.name}`,
      );
      setTargetSpeakerForVoiceModal(null);
    } else {
      void saveSettings({ voiceId: voice.id }, `Voice changed to ${voice.name}`);
    }
  };

  const handleLanguageChange = (field: 'originalLanguage' | 'targetLanguage', value: string) => {
    if (settingsSaveInFlightRef.current || project[field] === value) return;
    let newVoiceId = project.voiceId;
    if (field === 'targetLanguage') {
      const matchVoice = VOICES.find(v => v.languageCode === value);
      if (matchVoice) newVoiceId = matchVoice.id;
    }

    void saveSettings({ [field]: value, voiceId: newVoiceId }, 'Language settings saved.');
  };

  const handleStartGeneration = async () => {
    if (isProcessing || isStartingProcessRef.current || saveStatus === 'saving' || settingsSaveInFlightRef.current) return;
    if (!speechCadence) {
      showError('Choose a Speech Cadence before starting dubbing.');
      return;
    }
    if (autoCloneVoices && project.transcript.some((segment) => !segment.speaker || segment.speakerSource !== 'diarization')) {
      showError('Re-transcribe this video to identify every speaker before automatic voice cloning.');
      return;
    }
    isStartingProcessRef.current = true;
    let savingTranscript = false;

    try {
      await api.projects.update(project.id, {
        voiceId: project.voiceId,
        speakerVoices: project.speakerVoices || {},
        originalLanguage: project.originalLanguage,
        targetLanguage: project.targetLanguage,
      });
      if (project.transcript.length > 0) {
        savingTranscript = true;
        setSaveStatus('saving');
        await api.projects.updateTranscript(project.id, project.transcript);
        savingTranscript = false;
        setSaveStatus('saved');
      }
      setIsProcessing(true);
      const updated = {
        ...project,
        status: 'processing' as const,
        updatedAt: new Date().toISOString(),
      };
      setProject(updated);
      if (onUpdateProject) onUpdateProject(updated);

      const res = await api.dubbing.process({
        projectId: project.id,
        mediaId: project.mediaId,
        originalLanguage: project.originalLanguage,
        targetLanguage: project.targetLanguage,
        voiceId: project.voiceId,
        autoCloneVoices,
        speechCadence, qualityMode,
        duration: project.duration,
      });

      if (res?.jobId) {
        setCurrentJobId(res.jobId);
      }
      if (typeof res?.minutesBalance === 'number') {
        onMinutesBalanceChange?.(res.minutesBalance);
      }
    } catch (err: any) {
      if (savingTranscript) setSaveStatus('error');
      console.error('Failed to start dubbing pipeline:', err);
      showError(err.message || 'Failed to start dubbing job.');
      setIsProcessing(false);
      const updated = {
        ...project,
        status: 'draft' as const,
        updatedAt: new Date().toISOString(),
      };
      setProject(updated);
      if (onUpdateProject) onUpdateProject(updated);
    } finally {
      isStartingProcessRef.current = false;
    }
  };

  const handleProcessingComplete = (result?: any) => {
    setIsProcessing(false);
    setActiveAudioTrack('dubbed');
    
    const updatedTranscript = result?.transcript && Array.isArray(result.transcript)
      ? result.transcript
      : project.transcript;

    const updated: Project = {
      ...project,
      transcript: updatedTranscript,
      qualityMode: result?.qualityMode || project.qualityMode,
      dialogueUrl: result?.dialogueUrl || project.dialogueUrl,
      backgroundUrl: result?.backgroundUrl || project.backgroundUrl,
      audioUrl: result?.audioUrl || project.audioUrl,
      dubbedAudioUrl: result?.audioUrl || project.dubbedAudioUrl,
      dubbedVideoUrl: result?.videoUrl || project.dubbedVideoUrl,
      outputMediaId: result?.videoMediaId || project.outputMediaId,
      outputAudioMediaId: result?.audioMediaId || project.outputAudioMediaId,
      status: 'completed' as const,
      updatedAt: new Date().toISOString(),
    };

    setProject(updated);
    if (onUpdateProject) onUpdateProject(updated);
    api.projects.update(project.id, { status: 'completed' }).catch(() => {});
    showSuccess('AI Dubbing completed successfully!');
  };

  const handleRetryGeneration = async () => {
    if (!currentJobId) {
      throw new Error('The failed dubbing job could not be identified.');
    }

    try {
      const response = await api.dubbing.retryJob(currentJobId);
      if (typeof response.minutesBalance === 'number') {
        onMinutesBalanceChange?.(response.minutesBalance);
      }
      const updated = {
        ...project,
        status: 'processing' as const,
        updatedAt: new Date().toISOString(),
      };
      setProject(updated);
      if (onUpdateProject) onUpdateProject(updated);
      showSuccess('Dubbing retry started.');
    } catch (err: any) {
      showError(err.message || 'Failed to retry dubbing job.');
      throw err;
    }
  };

  const handleUpdateSegment = (segmentId: string, originalText: string, translatedText: string) => {
    setSaveStatus('saving');
    const updatedTranscript = project.transcript.map(seg => 
      seg.id === segmentId ? {
        ...seg,
        originalText,
        translatedText,
        ...(project.qualityMode === 'cinema' ? { regenerationStatus: 'pending' as const } : {}),
        translationEdited: translatedText !== seg.translatedText
          ? true
          : originalText !== seg.originalText ? false : seg.translationEdited,
      } : seg
    );
    const updated = {
      ...project,
      transcript: updatedTranscript,
      updatedAt: new Date().toISOString(),
    };
    setProject(updated);
    if (onUpdateProject) onUpdateProject(updated);

    // Synchronize with backend database
    api.projects.updateTranscript(project.id, updatedTranscript)
      .then(() => {
        setSaveStatus('saved');
      })
      .catch(err => {
        console.warn('Could not sync transcript:', err);
        setSaveStatus('error');
        showError('Failed to save transcript update.');
      });
  };

  const handleDownload = async (format: 'video' | 'audio' | 'srt') => {
    if (format === 'srt') {
      try {
        await api.dubbing.downloadSubtitles(project.id, 'srt');
        showSuccess('Subtitles exported (.SRT)');
      } catch {
        // fallback to generating client-side SRT
        try {
          let srtContent = '';
          project.transcript.forEach((seg, idx) => {
            srtContent += `${idx + 1}\n${formatSrtTime(seg.startTime)} --> ${formatSrtTime(seg.endTime)}\n${seg.translatedText || seg.originalText}\n\n`;
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
      if (!project.outputMediaId || !project.dubbedVideoUrl) {
        showError('Dubbed video export is not available yet. Attach and process a video first.');
        return;
      }
      try {
        await api.media.download(project.outputMediaId, `${project.title.replace(/\s+/g, '_')}_dubbed.mp4`);
        showSuccess('Master dubbed video exported (MP4)');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to download dubbed video.');
      }
    } else {
      if (!project.outputAudioMediaId || !project.audioUrl) {
        showError('Dubbed audio export is not available yet. Generate a dub first.');
        return;
      }
      try {
        await api.media.download(project.outputAudioMediaId, `${project.title.replace(/\s+/g, '_')}_dubbed.m4a`);
        showSuccess('Master dubbed audio exported (M4A)');
      } catch (error) {
        showError(error instanceof Error ? error.message : 'Failed to download dubbed audio.');
      }
    }
  };

  const handleVideoUploaded = (videoUrl: string, duration?: number, mediaId?: string) => {
    const updated = {
      ...project,
      videoUrl,
      sourceVideoUrl: videoUrl,
      mediaId: mediaId || project.mediaId,
      duration: duration || project.duration,
      updatedAt: new Date().toISOString(),
    };
    setProject(updated);
    if (onUpdateProject) onUpdateProject(updated);
    showSuccess('Video attached to studio workspace!');
  };

  // Distinct speakers in transcript
  const distinctSpeakers = Array.from(
    new Set(project.transcript.map(s => s.speaker).filter(Boolean))
  ) as string[];
  const unverifiedSegmentCount = project.transcript.filter((segment) =>
    !segment.speaker?.trim() || segment.speakerSource !== 'diarization'
  ).length;

  return (
    <div style={{ backgroundColor: 'var(--c-white)', minHeight: 'calc(100vh - 68px)' }}>
      {/* Top Workspace Header Bar */}
      <div className="studio-topbar" style={{
        borderBottom: 'var(--border-light)',
        backgroundColor: 'var(--c-white)',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {/* Breadcrumb & Project Name */}
        <div className="studio-project-heading" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleBack}
            className="btn btn-ghost btn-sm"
            style={{ padding: '6px 8px', color: 'var(--black-60)' }}
            title="Back to Dashboard"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="studio-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="studio-brand"><Logo size={16} /></span>
            <span className="studio-brand" style={{ fontSize: 'var(--text-control)', color: 'var(--black-60)', fontWeight: 600 }}>dubla.uz</span>
            <span className="studio-brand" style={{ color: 'var(--black-20)' }}>/</span>
            <h1 className="studio-project-title" title={project.title} style={{ fontSize: '14px', fontWeight: 700, color: 'var(--black-100)' }}>
              {truncateProjectTitle(project.title)}
            </h1>
            <span className={`badge badge-${project.status}`} style={{ marginLeft: '6px', flexShrink: 0 }}>
              {project.status}
            </span>
          </div>
        </div>

        {/* Right Studio Actions */}
        <div className="studio-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {project.status === 'completed' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => handleDownload('srt')}
                className="btn btn-secondary btn-sm"
                title="Export Subtitles"
                aria-label="Export Subtitles"
              >
                <FileText size={14} />
                SRT
              </button>
              <button
                onClick={() => handleDownload('video')}
                className="btn btn-primary btn-sm"
                aria-label="Download video"
                disabled={!project.dubbedVideoUrl}
                title={project.dubbedVideoUrl ? 'Download dubbed video' : 'Dubbed video export is not available yet'}
                style={!project.dubbedVideoUrl ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
              >
                <Download size={14} />
                Download video ↓
              </button>
            </div>
          )}
        </div>
      </div>

      <FilmPanel project={project} onRefresh={() => { void api.projects.get(project.id).then(({ project: latest }) => { setProject(latest); onSettingsSaved?.(project.id, latest); }); }} />
      {/* Workspace Content */}
      {isProcessing ? (
        <ProcessingView
          project={project}
          jobId={currentJobId}
          onComplete={handleProcessingComplete}
          onError={(msg) => {
            showError(msg);
            if (qualityMode === 'cinema') {
              api.projects.get(project.id).then(({ project: latest }) => {
                setProject(latest); setIsProcessing(false); onSettingsSaved?.(project.id, latest);
              }).catch(() => {});
            }
          }}
          onRetry={handleRetryGeneration}
          onMinutesBalanceChange={onMinutesBalanceChange}
        />
      ) : (
        <div className="container-xl" style={{ padding: '32px 24px' }}>
          {project.status === 'completed' && (
            <div className="studio-ready-banner" style={{
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
                <p style={{ fontSize: 'var(--text-body)', color: 'var(--black-60)', marginTop: '2px' }}>
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
                  onClick={() => handleDownload('audio')}
                  className="btn btn-secondary"
                  disabled={!project.dubbedAudioUrl}
                  title={project.dubbedAudioUrl ? 'Download dubbed audio' : 'Dubbed audio is not available yet'}
                  style={{
                    opacity: project.dubbedAudioUrl ? 1 : 0.45,
                    cursor: project.dubbedAudioUrl ? 'pointer' : 'not-allowed',
                  }}
                  aria-label="Download dubbed audio"
                >
                  <Download size={15} />
                  Audio
                </button>
                <button
                  onClick={() => handleDownload('video')}
                  className="btn btn-primary"
                  disabled={!project.dubbedVideoUrl}
                  title={project.dubbedVideoUrl ? 'Download dubbed video' : 'Dubbed video export is not available yet'}
                  style={{
                    fontWeight: 600,
                    opacity: project.dubbedVideoUrl ? 1 : 0.45,
                    cursor: project.dubbedVideoUrl ? 'pointer' : 'not-allowed',
                  }}
                  aria-label="Download video"
                >
                  <Download size={15} />
                  Download video ↓
                </button>
                <button
                  onClick={onOpenNewDub}
                  className="btn btn-secondary"
                  aria-label="Create another project"
                >
                  Create another →
                </button>
              </div>
            </div>
          )}

          {/* Main 2-Column Studio Grid */}
          <div className="studio-grid" style={{
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
                  onVideoUploaded={handleVideoUploaded}
                />
              </div>

              {/* Dubbing Settings Panel */}
              <div className="card studio-settings" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} />
                  Dubbing Configuration
                </h3>
                {isSettingsSaving && <p role="status">Saving studio settings...</p>}

                <div className="studio-language-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label className="label" htmlFor="studio-original-language">Original language</label>
                    <select
                      id="studio-original-language"
                      className="select"
                      value={project.originalLanguage}
                      disabled={isSettingsSaving}
                      onChange={e => handleLanguageChange('originalLanguage', e.target.value)}
                    >
                      <option value="auto">Auto detect</option>
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label" htmlFor="studio-target-language">Translate to</label>
                    <select
                      id="studio-target-language"
                      className="select"
                      value={project.targetLanguage}
                      disabled={isSettingsSaving}
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

                {/* Primary Voice Selection */}
                <div style={{ marginBottom: '20px' }}>
                  <label className="label">Primary Neural Voice Profile</label>
                  <div
                    className="studio-voice-picker"
                    style={{
                      border: 'var(--border-light)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '14px 16px',
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
                      <div style={{ fontSize: 'var(--text-meta)', color: 'var(--black-60)', marginTop: '2px' }}>
                        {currentVoice.language} • {currentVoice.tone}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      aria-haspopup="dialog"
                      onClick={() => {
                        setTargetSpeakerForVoiceModal(null);
                        setIsVoiceModalOpen(true);
                      }}
                      disabled={isSettingsSaving}
                      style={{ padding: '6px 12px' }}
                    >
                      Change voice →
                    </button>
                  </div>
                </div>

                {/* Speaker Voice Mapping (if distinct speakers exist) */}
                {distinctSpeakers.length > 1 && (
                  <div style={{ marginBottom: '24px', paddingTop: '16px', borderTop: 'var(--border-light)' }}>
                    <label className="label">Speaker Voice Assignments ({distinctSpeakers.length} speakers in transcript)</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                      {distinctSpeakers.map((speaker) => {
                        const assignedVoiceId = project.speakerVoices?.[speaker] || project.voiceId;
                        const speakerVoice = VOICES.find(v => v.id === assignedVoiceId) || currentVoice;

                        return (
                          <div
                            key={speaker}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              border: 'var(--border-light)',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: 'var(--black-02)',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 'var(--text-control)', fontWeight: 700 }}>{speaker}</div>
                              <div style={{ fontSize: 'var(--text-meta)', color: 'var(--black-60)' }}>
                                {speakerVoice.name} ({speakerVoice.style})
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setTargetSpeakerForVoiceModal(speaker);
                                setIsVoiceModalOpen(true);
                              }}
                              disabled={isSettingsSaving}
                              className="btn btn-ghost btn-sm"
                              style={{ fontSize: 'var(--text-control)', padding: '4px 8px' }}
                            >
                              Assign Voice →
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {unverifiedSegmentCount > 0 && (
                  <p role="status" style={{ marginBottom: '16px', fontSize: 'var(--text-body)', lineHeight: 1.45, color: 'var(--black-70)' }}>
                    Speaker identity is missing or unverified in {unverifiedSegmentCount} transcript segment{unverifiedSegmentCount === 1 ? '' : 's'}. Re-transcribe before using automatic voice cloning.
                  </p>
                )}

                <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '10px', fontSize: 'var(--text-control)', lineHeight: 1.45 }}>
                  <input type="checkbox" checked={autoCloneVoices} onChange={(event) => setAutoCloneVoices(event.target.checked)} disabled={isProcessing} />
                  Clone each detected speaker's voice for the translated dub
                </label>
                {autoCloneVoices && (
                  <>
                    <p role="status" style={{ marginBottom: 10 }}>Voice cloning tanlansa, kreditlaringiz 1,5 barobar ko‘p sarflanadi.</p>
                    {canCloneVoices === false && (
                      <p role="status" style={{ marginBottom: '12px', fontSize: 'var(--text-body)', color: 'var(--black-70)' }}>
                        Automatic voice cloning requires an ElevenLabs API key on the server.
                      </p>
                    )}
                  </>
                )}

                {/* Generate Dub Primary Action */}
                <QualityModeField value={qualityMode} onChange={setQualityMode} disabled={isProcessing} />
                <SpeechCadenceField value={speechCadence} onChange={setSpeechCadence} disabled={isProcessing || isSettingsSaving} />
                <button
                  type="button"
                  onClick={handleStartGeneration}
                  disabled={isProcessing || isSettingsSaving || saveStatus === 'saving' || canRenderFinalDub === false || (autoCloneVoices && canCloneVoices === false)}
                  className="btn btn-primary btn-lg"
                  title={canRenderFinalDub === false ? 'Configure an OpenAI or ElevenLabs TTS key to render a final dub.' : undefined}
                  style={{ width: '100%', padding: '14px', fontSize: '15px', opacity: isProcessing || isSettingsSaving || saveStatus === 'saving' || canRenderFinalDub === false ? 0.7 : 1 }}
                >
                  <Sparkles size={16} />
                  {project.status === 'completed' ? 'Re-generate dub →' : 'Generate dub →'}
                </button>
                {canRenderFinalDub === false && (
                  <p role="status" style={{ marginTop: '10px', fontSize: 'var(--text-body)', lineHeight: 1.45, color: 'var(--black-60)' }}>
                    Final dub rendering is unavailable until an OpenAI or ElevenLabs TTS API key is configured on the server.
                  </p>
                )}
              </div>
            </div>

            {/* Right Column: Transcript & Translation Editor */}
            <div>
              {project.qualityMode === 'cinema' && <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
                {([["Original", project.sourceVideoUrl || project.videoUrl], ["Clean dialogue", project.dialogueUrl], ["Music & effects", project.backgroundUrl], ["Final dub", project.dubbedAudioUrl]] as const).map(([label, url]) => url &&
                  <label key={label}>{label}<audio controls preload="none" src={url} style={{ display: 'block', width: '100%' }} /></label>)}
              </div>}
              <TranscriptEditor
                segments={project.transcript}
                onUpdateSegment={handleUpdateSegment}
                onChangeMetadata={project.qualityMode === 'cinema' ? async (id, patch) => {
                  const transcript = project.transcript.map(s => s.id === id ? { ...s, ...patch, regenerationStatus: 'pending' as const } : s);
                  setSaveStatus('saving');
                  try { await api.projects.updateTranscript(project.id, transcript); setProject({ ...project, transcript }); setSaveStatus('saved'); }
                  catch { setSaveStatus('error'); showError('Could not save segment changes.'); }
                } : undefined}
                onRegenerate={project.qualityMode === 'cinema' && !isProcessing ? async (id) => {
                  if (saveStatus !== 'saved') { showError('Save your edits before regenerating.'); return; }
                  try {
                    const response = await api.dubbing.regenerate(project.id, { segmentIds: [id], speechCadence: speechCadence || 'natural' });
                    setCurrentJobId(response.jobId); setIsProcessing(true); setProject({ ...project, status: 'processing' });
                    onMinutesBalanceChange?.(response.minutesBalance);
                  } catch (error) { showError(error instanceof Error ? error.message : 'Could not regenerate segment.'); }
                } : undefined}
                targetLanguage={project.targetLanguage}
                originalLanguage={project.originalLanguage}
                currentPlayTime={currentPlayTime}
                onSeekToTime={(time) => setSeekTime(time)}
                saveStatus={saveStatus}
                onRetryTranscription={currentTranscriptionJobId ? handleRetryTranscription : undefined}
              />
            </div>
          </div>
        </div>
      )}

      {/* Voice Selection Modal */}
      <VoiceModal
        isOpen={isVoiceModalOpen}
        selectedVoiceId={
          targetSpeakerForVoiceModal && project.speakerVoices?.[targetSpeakerForVoiceModal]
            ? project.speakerVoices[targetSpeakerForVoiceModal]
            : project.voiceId
        }
        onSelectVoice={handleSelectVoice}
        onClose={() => {
          setTargetSpeakerForVoiceModal(null);
          setIsVoiceModalOpen(false);
        }}
        filterLanguageCode={project.targetLanguage}
        renderableVoiceIds={renderableVoiceIds}
      />
    </div>
  );
};
