import React from 'react';

interface ProjectSkeletonProps {
  viewMode?: 'grid' | 'list';
  count?: number;
}

export const ProjectSkeleton: React.FC<ProjectSkeletonProps> = ({
  viewMode = 'grid',
  count = 6,
}) => {
  const items = Array.from({ length: count }, (_, i) => i);

  if (viewMode === 'list') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading projects"
        className="project-skeleton-list"
        style={{
          backgroundColor: 'var(--c-white)',
          border: 'var(--border-light)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        <span className="sr-only">Loading projects, please wait...</span>
        <div style={{ padding: '12px 16px', backgroundColor: 'var(--black-02)', borderBottom: 'var(--border-light)' }}>
          <div className="skeleton-box" style={{ height: '14px', width: '240px' }} />
        </div>
        {items.map((i) => (
          <div
            key={i}
            style={{
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: i < count - 1 ? 'var(--border-light)' : 'none',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 2 }}>
              <div className="skeleton-box" style={{ width: '36px', height: '24px', borderRadius: '4px', flexShrink: 0 }} />
              <div className="skeleton-box" style={{ width: '60%', height: '16px' }} />
            </div>
            <div className="skeleton-box" style={{ width: '70px', height: '20px', borderRadius: '100px', flex: 1 }} />
            <div className="skeleton-box" style={{ width: '80px', height: '14px', flex: 1 }} />
            <div className="skeleton-box" style={{ width: '50px', height: '14px', flex: 1 }} />
            <div className="skeleton-box" style={{ width: '28px', height: '28px', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading projects"
      className="project-skeleton-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px',
      }}
    >
      <span className="sr-only">Loading projects, please wait...</span>
      {items.map((i) => (
        <div
          key={i}
          className="card"
          style={{
            padding: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="skeleton-box" style={{ aspectRatio: '16 / 9', minHeight: '144px', width: '100%' }} />
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="skeleton-box" style={{ height: '18px', width: '75%' }} />
            <div className="skeleton-box" style={{ height: '14px', width: '45%' }} />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '12px',
                borderTop: 'var(--border-light)',
              }}
            >
              <div className="skeleton-box" style={{ height: '12px', width: '30%' }} />
              <div className="skeleton-box" style={{ height: '16px', width: '16px', borderRadius: '4px' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
