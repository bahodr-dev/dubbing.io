import React from 'react';
import { clampProgress } from '../../utils/formatters';

interface ProjectProgressProps {
  progress?: number;
  className?: string;
  showLabel?: boolean;
}

export const ProjectProgress: React.FC<ProjectProgressProps> = ({
  progress,
  className = '',
  showLabel = true,
}) => {
  const clamped = clampProgress(progress);
  const isDeterminate = typeof clamped === 'number';

  return (
    <div className={`project-progress-wrapper ${className}`} style={{ width: '100%' }}>
      {showLabel && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 'var(--text-meta)',
            marginBottom: '4px',
            color: 'var(--black-60)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <span>Processing dubbing...</span>
          <span>{isDeterminate ? `${clamped}%` : 'In progress'}</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label="Dubbing process progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={isDeterminate ? clamped : undefined}
        style={{
          width: '100%',
          height: '4px',
          backgroundColor: 'rgba(0, 0, 0, 0.08)',
          borderRadius: '2px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          className={!isDeterminate ? 'project-progress-indeterminate' : undefined}
          style={{
            height: '100%',
            backgroundColor: 'var(--c-black)',
            width: isDeterminate ? `${clamped}%` : '35%',
            borderRadius: '2px',
            transition: isDeterminate ? 'width 200ms ease' : undefined,
          }}
        />
      </div>
    </div>
  );
};
