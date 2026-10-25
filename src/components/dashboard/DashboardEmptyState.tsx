import React from 'react';
import { Search, Sparkles } from 'lucide-react';

interface DashboardEmptyStateProps {
  type: 'true-empty' | 'no-results';
  searchQuery?: string;
  onOpenNewDub?: () => void;
  onClearFilters?: () => void;
}

export const DashboardEmptyState: React.FC<DashboardEmptyStateProps> = ({
  type,
  searchQuery,
  onOpenNewDub,
  onClearFilters,
}) => {
  if (type === 'true-empty') {
    return (
      <div
        className="dashboard-empty-state"
        style={{
          textAlign: 'center',
          padding: '80px 24px',
          border: '1px dashed rgba(0, 0, 0, 0.15)',
          borderRadius: '16px',
          backgroundColor: '#FAFAFB',
        }}
      >
        <div
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <Sparkles size={24} color="var(--c-black)" />
        </div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '8px', letterSpacing: '-0.01em' }}>
          No dubbing projects yet
        </h2>
        <p style={{ fontSize: 'var(--text-body)', color: 'rgba(0, 0, 0, 0.6)', maxWidth: '420px', margin: '0 auto 24px', lineHeight: 1.5 }}>
          Translate your first video into Uzbek or any target language in seconds.
        </p>
        {onOpenNewDub && (
          <button
            type="button"
            onClick={onOpenNewDub}
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
            <Sparkles size={15} />
            <span>Create first project</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="dashboard-no-results-state"
      style={{
        textAlign: 'center',
        padding: '70px 24px',
        border: '1px dashed rgba(0, 0, 0, 0.15)',
        borderRadius: '16px',
        backgroundColor: '#FAFAFB',
      }}
    >
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '50%',
          backgroundColor: 'rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <Search size={22} color="rgba(0, 0, 0, 0.5)" />
      </div>
      <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '8px', letterSpacing: '-0.01em' }}>
        No matching projects found
      </h2>
      <p style={{ fontSize: 'var(--text-body)', color: 'rgba(0, 0, 0, 0.6)', maxWidth: '440px', margin: '0 auto', lineHeight: 1.5 }}>
        {searchQuery ? (
          <>No dubbing project matched your search for <strong>"{searchQuery}"</strong>.</>
        ) : (
          'No projects match the selected status filter.'
        )}
      </p>
      {onClearFilters && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onClearFilters} style={{ marginTop: '20px' }}>
          Reset search
        </button>
      )}
    </div>
  );
};
