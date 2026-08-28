import React from 'react';
import { LayoutGrid, List } from 'lucide-react';

interface ViewModeToggleProps {
  viewMode: 'grid' | 'list';
  onToggle: (mode: 'grid' | 'list') => void;
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({ viewMode, onToggle }) => {
  return (
    <div
      style={{
        display: 'flex',
        border: 'var(--border-light)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => onToggle('grid')}
        style={{
          padding: '6px 10px',
          border: 'none',
          background: viewMode === 'grid' ? 'var(--black-100)' : 'var(--c-white)',
          color: viewMode === 'grid' ? 'var(--white-100)' : 'var(--black-60)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 120ms ease',
        }}
        title="Grid view"
      >
        <LayoutGrid size={15} />
      </button>
      <button
        type="button"
        onClick={() => onToggle('list')}
        style={{
          padding: '6px 10px',
          border: 'none',
          borderLeft: 'var(--border-light)',
          background: viewMode === 'list' ? 'var(--black-100)' : 'var(--c-white)',
          color: viewMode === 'list' ? 'var(--white-100)' : 'var(--black-60)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 120ms ease',
        }}
        title="List view"
      >
        <List size={15} />
      </button>
    </div>
  );
};
