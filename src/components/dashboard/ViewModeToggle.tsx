import React from 'react';
import { LayoutGrid, List } from 'lucide-react';

interface ViewModeToggleProps {
  viewMode: 'grid' | 'list';
  onToggle: (mode: 'grid' | 'list') => void;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ viewMode, onToggle }) => {
  return (
    <div
      role="group"
      aria-label="View mode selection"
      className="view-mode-toggle"
      style={{
        display: 'inline-flex',
        border: '1px solid rgba(0, 0, 0, 0.12)',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
      }}
    >
      <button
        type="button"
        onClick={() => onToggle('grid')}
        aria-label="Grid view"
        aria-pressed={viewMode === 'grid'}
        title="Grid view"
        style={{
          padding: '7px 11px',
          border: 'none',
          background: viewMode === 'grid' ? '#111827' : 'transparent',
          color: viewMode === 'grid' ? '#FFFFFF' : 'rgba(0, 0, 0, 0.6)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 120ms ease',
        }}
      >
        <LayoutGrid size={15} />
      </button>
      <button
        type="button"
        onClick={() => onToggle('list')}
        aria-label="List view"
        aria-pressed={viewMode === 'list'}
        title="List view"
        style={{
          padding: '7px 11px',
          border: 'none',
          borderLeft: '1px solid rgba(0, 0, 0, 0.1)',
          background: viewMode === 'list' ? '#111827' : 'transparent',
          color: viewMode === 'list' ? '#FFFFFF' : 'rgba(0, 0, 0, 0.6)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 120ms ease',
        }}
      >
        <List size={15} />
      </button>
    </div>
  );
};
