import React, { useState, useEffect } from 'react';
import type { Project, ProcessingStep } from '../types';
import { Check, Loader2, Sparkles } from 'lucide-react';

interface ProcessingViewProps {
  project: Project;
  jobId?: string;
  onComplete: () => void;
}

const STAGES: ProcessingStep[] = [
  { id: 'upload', label: 'Video uploaded', detail: '1080p source stream validated', targetPercent: 15 },
  { id: 'extract', label: 'Audio extracted & normalized', detail: 'Acoustic waveform separated at 44.1 kHz', targetPercent: 32 },
  { id: 'transcribe', label: 'Speech transcribed', detail: 'Automatic timestamp alignment generated with Whisper', targetPercent: 52 },
  { id: 'translate', label: 'Translation completed', detail: 'Neural semantic mapping into target language', targetPercent: 72 },
  { id: 'voice', label: 'Generating neural voice', detail: 'Synthesizing voiceover with studio voice profile', targetPercent: 88 },
  { id: 'render', label: 'Rendering video & muxing', detail: 'Synchronizing timeline audio and video tracks', targetPercent: 100 },
];

export const ProcessingView: React.FC<ProcessingViewProps> = ({
  project,
  jobId,
  onComplete,
}) => {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [progressPercent, setProgressPercent] = useState(12);
  const [streamedText, setStreamedText] = useState('');

  const sampleTokens = [
    "Hello", "everyone,", "welcome", "to", "our", "keynote...",
    "Assalomu", "alaykum", "barchaga,", "yangi", "avlod", "mahsulot", "taqdimotiga", "xush", "kelibsiz."
  ];

  // If jobId is provided, poll status from backend job queue
  useEffect(() => {
    if (!jobId) {
      const stepInterval = setInterval(() => {
        setCurrentStepIdx(prev => {
          if (prev < STAGES.length - 1) {
            const next = prev + 1;
            setProgressPercent(STAGES[next].targetPercent);
            return next;
          } else {
            clearInterval(stepInterval);
            setTimeout(() => {
              onComplete();
            }, 800);
            return prev;
          }
        });
      }, 1400);

      return () => clearInterval(stepInterval);
    }

    // Polling mode
    let isCancelled = false;
    const pollJob = async () => {
      try {
        const res = await (window as any).api?.dubbing?.getJob(jobId);
        if (isCancelled || !res?.job) return;

        const job = res.job;
        if (job.progress) setProgressPercent(job.progress);

        if (job.status === 'transcribing') setCurrentStepIdx(2);
        else if (job.status === 'translating') setCurrentStepIdx(3);
        else if (job.status === 'synthesizing') setCurrentStepIdx(4);
        else if (job.status === 'completed') {
          setCurrentStepIdx(5);
          setProgressPercent(100);
          setTimeout(() => onComplete(), 600);
          return;
        }
      } catch (err) {
        console.warn('Job polling error:', err);
      }
    };

    const interval = setInterval(pollJob, 1200);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [jobId, onComplete]);

  // Token streamer animation for transcription realism
  useEffect(() => {
    let tokenIndex = 0;
    const tokenInterval = setInterval(() => {
      if (tokenIndex < sampleTokens.length) {
        setStreamedText(prev => (prev ? prev + ' ' : '') + sampleTokens[tokenIndex]);
        tokenIndex++;
      } else {
        clearInterval(tokenInterval);
      }
    }, 450);

    return () => clearInterval(tokenInterval);
  }, []);

  return (
    <div style={{
      maxWidth: '720px',
      margin: '40px auto',
      padding: '40px 32px',
      backgroundColor: 'var(--c-white)',
      border: 'var(--border-light)',
      borderRadius: 'var(--radius-lg)',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '5px 14px',
          border: 'var(--border-light)',
          borderRadius: 'var(--radius-pill)',
          fontSize: '12px',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '16px',
        }}>
          <Sparkles size={13} />
          AI Neural Pipeline Active
        </div>

        <h2 style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '8px' }}>
          Creating your dub
        </h2>
        <p style={{ fontSize: '15px', color: 'var(--black-60)' }}>
          Transforming <span style={{ fontWeight: 600, color: 'var(--black-100)' }}>{project.title}</span> into {project.targetLanguage === 'uz' ? "Uzbek (O'zbek)" : project.targetLanguage.toUpperCase()}
        </p>
      </div>

      {/* Numerical Progress Indicator */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--black-60)' }}>
            Processing Pipeline
          </span>
          <span className="mono" style={{ fontSize: '32px', fontWeight: 800, color: 'var(--black-100)' }}>
            {progressPercent}%
          </span>
        </div>

        <div style={{
          height: '6px',
          backgroundColor: 'var(--black-10)',
          borderRadius: 'var(--radius-pill)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progressPercent}%`,
            backgroundColor: 'var(--black-100)',
            transition: 'width 600ms cubic-bezier(0.16, 1, 0.3, 1)',
          }} />
        </div>
      </div>

      {/* Stages List */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        marginBottom: '32px',
      }}>
        {STAGES.map((stage, idx) => {
          const isDone = idx < currentStepIdx;
          const isCurrent = idx === currentStepIdx;
          const isPending = idx > currentStepIdx;

          return (
            <div
              key={stage.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                border: isCurrent ? '1px solid var(--black-100)' : 'var(--border-light)',
                backgroundColor: isCurrent ? 'var(--black-05)' : isDone ? 'var(--black-02)' : 'var(--c-white)',
                borderRadius: 'var(--radius-sm)',
                transition: 'all 200ms ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDone ? 'var(--black-100)' : isCurrent ? 'var(--c-white)' : 'transparent',
                  border: isDone ? '1px solid var(--black-100)' : isCurrent ? '2px solid var(--black-100)' : '1px solid var(--black-20)',
                  color: isDone ? 'var(--white-100)' : 'var(--black-100)',
                }}>
                  {isDone ? (
                    <Check size={14} strokeWidth={3} />
                  ) : isCurrent ? (
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <span style={{ fontSize: '10px', color: 'var(--black-40)' }}>{idx + 1}</span>
                  )}
                </div>

                <div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: isCurrent ? 700 : isDone ? 600 : 400,
                    color: isPending ? 'var(--black-40)' : 'var(--black-100)',
                  }}>
                    {stage.label}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: isPending ? 'var(--black-30)' : 'var(--black-60)',
                    marginTop: '2px',
                  }}>
                    {stage.detail}
                  </div>
                </div>
              </div>

              <div>
                {isDone && (
                  <span className="mono" style={{ fontSize: '11px', color: 'var(--black-60)' }}>
                    Done
                  </span>
                )}
                {isCurrent && (
                  <span className="badge badge-processing">
                    Active
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Stream Terminal Reassurance */}
      <div style={{
        backgroundColor: 'var(--black-100)',
        color: 'var(--white-100)',
        padding: '16px 20px',
        borderRadius: 'var(--radius-md)',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
      }}>
        <div style={{ color: 'var(--white-40)', marginBottom: '6px', fontSize: '11px' }}>
          LIVE NEURAL INFERENCE STREAM:
        </div>
        <div style={{ minHeight: '36px', lineHeight: 1.5 }}>
          {streamedText || 'Initializing whisper transcript token weights...'}
          <span style={{ display: 'inline-block', width: '8px', height: '12px', backgroundColor: '#ffffff', marginLeft: '4px', animation: 'pulseDot 0.8s infinite' }} />
        </div>
      </div>
    </div>
  );
};
