import React from 'react';
import type { Project, ProjectStatus } from '../../types';

interface FilterBarProps {
  projects: Project[];
  statusFilter: 'all' | ProjectStatus;
  onFilterChange: (filter: 'all' | ProjectStatus) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  projects,
  statusFilter,
  onFilterChange,
}) => {
  const filters: Array<'all' | ProjectStatus> = ['all', 'completed', 'processing', 'draft'];

  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {filters.map((filter) => {
        const count =
          filter === 'all'
            ? projects.length
            : projects.filter((p) => p.status === filter).length;

        const isActive = statusFilter === filter;

        return (
          <button
            key={filter}
            type="button"
            onClick={() => onFilterChange(filter)}
            className="badge"
            style={{
              border: 'none',
              backgroundColor: isActive ? 'var(--black-100)' : 'transparent',
              color: isActive ? 'var(--white-100)' : 'var(--black-60)',
              cursor: 'pointer',
              textTransform: 'capitalize',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: isActive ? 600 : 500,
              transition: 'all 120ms ease',
            }}
          >
            {filter === 'all' ? 'All' : filter} {count > 0 && `(${count})`}
          </button>
        );
      })}
    </div>
  );
};
