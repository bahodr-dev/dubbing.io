import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface DashboardErrorStateProps {
  variant?: 'banner' | 'full';
  onRetry: () => void;
  message?: string;
}

export const DashboardErrorState: React.FC<DashboardErrorStateProps> = ({
  variant = 'full',
  onRetry,
  message = 'Could not sync projects with the server.',
}) => {
  if (variant === 'banner') {
    return (
      <div
        role="alert"
        className="dashboard-error-banner"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: '#FAFAFB',
          border: '1px solid rgba(0, 0, 0, 0.15)',
          borderRadius: '8px',
          marginBottom: '20px',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertTriangle size={16} color="var(--c-black)" />
          <span style={{ fontSize: 'var(--text-control)', color: '#111827', fontWeight: 500 }}>
            {message} Showing offline cached projects.
          </span>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-secondary btn-sm"
          style={{
            padding: '6px 12px',
            fontSize: 'var(--text-control)',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RefreshCw size={12} />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="dashboard-error-full"
      style={{
        textAlign: 'center',
        padding: '80px 24px',
        border: '1px solid rgba(0, 0, 0, 0.12)',
        borderRadius: '16px',
        backgroundColor: '#FAFAFB',
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <AlertTriangle size={24} color="var(--c-black)" />
      </div>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '8px', letterSpacing: '-0.01em' }}>
        Failed to load projects
      </h2>
      <p style={{ fontSize: 'var(--text-body)', color: 'rgba(0, 0, 0, 0.6)', maxWidth: '440px', margin: '0 auto 24px', lineHeight: 1.5 }}>
        {message} Please check your connection and retry.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="btn btn-primary"
        style={{
          padding: '10px 20px',
          fontSize: 'var(--text-control)',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <RefreshCw size={14} />
        <span>Retry loading</span>
      </button>
    </div>
  );
};
