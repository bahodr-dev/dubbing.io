import { QualityModeField } from '../components/QualityModeField';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { NewDubOptions, Project, VoiceMode, SpeechCadence } from '../types';
import { SpeechCadenceField } from '../components/SpeechCadenceField';
import { api } from '../services/api';
import { ProcessingView } from '../components/ProcessingView';

interface ProcessingPageProps {
  project?: Project;
  isProjectLoading: boolean;
  onCompleted: (projectId: string) => void | Promise<void>;
  onOpenStudio?: (project: Project) => void;
  onStarted?: (projectId: string) => void;
  onMinutesBalanceChange?: (minutesBalance: number) => void;
}

interface ProcessingNavigationState {
  jobId?: string;
  startError?: string;
  startOptions?: NewDubOptions;
}

export function ProcessingPage({ project, isProjectLoading, onCompleted, onStarted, onOpenStudio, onMinutesBalanceChange }: ProcessingPageProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navigationState = location.state as ProcessingNavigationState | null;
  const [jobId, setJobId] = useState<string | null>(navigationState?.jobId || null);
  const [error, setError] = useState<string | null>(navigationState?.startError || null);
  const [isLoadingJob, setIsLoadingJob] = useState(!navigationState?.jobId && !navigationState?.startError);
  const [isStarting, setIsStarting] = useState(false);
  const [qualityMode, setQualityMode] = useState<'standard' | 'cinema'>(navigationState?.startOptions?.qualityMode || project?.qualityMode || 'standard');
  const [speechCadence, setSpeechCadence] = useState<SpeechCadence | null>(navigationState?.startOptions?.speechCadence || null);
  const [voiceMode, setVoiceMode] = useState<VoiceMode | null>(navigationState?.startOptions?.voiceMode || null);
  const [finalizationError, setFinalizationError] = useState<string | null>(null);

  const openCompletedProject = async () => {
    if (!projectId) return;
    try {
      await onCompleted(projectId);
    } catch (cause) {
      setFinalizationError(cause instanceof Error ? cause.message : 'Could not open the finished project.');
    }
  };

  useEffect(() => {
    if (!projectId || jobId) return;
    let cancelled = false;
    api.dubbing.getLatestProjectJob(projectId)
      .then((response) => {
        if (!cancelled && response.job?.filmMode) { navigate(`/studio/${projectId}`, { replace: true }); return; }
        if (!cancelled) { setJobId(response.jobId); setError(null); setSpeechCadence(response.job.speechCadence || 'natural'); setQualityMode(response.job.qualityMode || 'standard'); }
      })
      .catch(() => {
        if (!cancelled && !navigationState?.startError) setError('No dubbing job was found for this project.');
      })
      .finally(() => { if (!cancelled) setIsLoadingJob(false); });
    return () => { cancelled = true; };
  }, [projectId, jobId, navigationState?.startError, navigate]);

  const startJob = async () => {
    if (!project || !voiceMode || !speechCadence || isStarting) return;
    setIsStarting(true);
    try {
      const options = { voiceMode, speechCadence, ...(qualityMode === 'cinema' ? { qualityMode } : {}) };
      const response = await api.dubbing.process({
        projectId: project.id,
        mediaId: project.mediaId,
        originalLanguage: project.originalLanguage,
        targetLanguage: project.targetLanguage,
        voiceId: project.voiceId,
        autoCloneVoices: options.voiceMode === 'clone',
        autoAssignSiteVoices: options.voiceMode === 'site',
        speechCadence: options.speechCadence,
        ...(qualityMode === 'cinema' ? { qualityMode } : {}),
      });
      setJobId(response.jobId);
      setError(null);
      onStarted?.(project.id);
      onMinutesBalanceChange?.(response.minutesBalance);
      navigate(location.pathname, { replace: true, state: { jobId: response.jobId, startOptions: options } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start dubbing.');
    } finally {
      setIsStarting(false);
    }
  };

  if (isProjectLoading && !project) return <div className="route-loading" role="status">Loading project…</div>;
  if (!project || !projectId) return <div role="alert">Project not found. <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button></div>;
  if (isLoadingJob && !jobId && !error) return <div className="route-loading" role="status">Loading dubbing job…</div>;
  if (finalizationError) return <div className="card" style={{ maxWidth: 620, margin: '40px auto', padding: 32 }}>
    <p role="alert">{finalizationError}</p>
    <button className="btn btn-primary" onClick={() => { void openCompletedProject(); }}>Open finished Studio</button>
  </div>;
  if (jobId) return <>
  <ProcessingView
    key={jobId}
    project={project}
    jobId={jobId}
    onComplete={() => { void openCompletedProject(); }}
    onError={setError}
    onRetry={async () => {
      const response = await api.dubbing.retryJob(jobId);
      setError(null);
      onStarted?.(project.id);
      onMinutesBalanceChange?.(response.minutesBalance);
    }}
    onMinutesBalanceChange={onMinutesBalanceChange}
  />
  {error && <div className="card" style={{ maxWidth: 620, margin: '16px auto', padding: 24 }}>
    {qualityMode === 'cinema' && onOpenStudio && <button className="btn btn-secondary" onClick={() => {
      api.projects.get(projectId).then(({ project: latest }) => onOpenStudio(latest)).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not open Studio.'));
    }}>Open Studio to review and edit</button>}
    <p style={{ marginBottom: 12 }}>Change the voice method and start a new dub:</p>
    <label style={{ display: 'block' }}><input type="radio" name="failed-voice-mode" checked={voiceMode === 'site'} onChange={() => setVoiceMode('site')} /> Use site voices</label>
    <label style={{ display: 'block' }}><input type="radio" name="failed-voice-mode" checked={voiceMode === 'clone'} onChange={() => setVoiceMode('clone')} /> Clone speaker voices</label>
    {voiceMode === 'clone' && <p role="status">Voice cloning tanlansa, kreditlaringiz 1,5 barobar ko‘p sarflanadi.</p>}
    <QualityModeField value={qualityMode} onChange={setQualityMode} disabled={isStarting} />
    <SpeechCadenceField value={speechCadence} onChange={setSpeechCadence} disabled={isStarting} />
    <button className="btn btn-primary" disabled={isStarting || !voiceMode || !speechCadence} onClick={startJob} style={{ marginTop: 12 }}>
      {isStarting ? 'Starting…' : 'Start new dub'}
    </button>
  </div>}
  </>;

  return <div className="card" style={{ maxWidth: 620, margin: '40px auto', padding: 32 }}>
    <h1 style={{ fontSize: 24, marginBottom: 12 }}>Dubbing could not start</h1>
    <p role="alert" style={{ marginBottom: 20 }}>{error}</p>
    <fieldset style={{ border: 0, padding: 0, marginBottom: 16 }}>
      <legend>Choose dubbing voices</legend>
      <label style={{ display: 'block' }}><input type="radio" name="retry-voice-mode" checked={voiceMode === 'site'} onChange={() => setVoiceMode('site')} /> Use site voices</label>
      <label style={{ display: 'block' }}><input type="radio" name="retry-voice-mode" checked={voiceMode === 'clone'} onChange={() => setVoiceMode('clone')} /> Clone speaker voices</label>
      {voiceMode === 'clone' && <p role="status">Voice cloning tanlansa, kreditlaringiz 1,5 barobar ko‘p sarflanadi.</p>}
    </fieldset>
    <QualityModeField value={qualityMode} onChange={setQualityMode} disabled={isStarting} />
    <SpeechCadenceField value={speechCadence} onChange={setSpeechCadence} disabled={isStarting} />
    <button className="btn btn-primary" disabled={isStarting || !voiceMode || !speechCadence} onClick={startJob}>
      {isStarting ? 'Starting…' : 'Try again'}
    </button>
    <button className="btn btn-secondary" onClick={() => navigate('/dashboard')} style={{ marginLeft: 8 }}>Back to Dashboard</button>
  </div>;
}
