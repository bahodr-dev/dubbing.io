import React from 'react';
import type { Project, ProjectStatus } from '../../types';

interface FilterBarProps {
  projects: Project[];
  statusFilter: 'all' | ProjectStatus;
  onFilterChange: (filter: 'all' | ProjectStatus) => void;
  availableFilters?: Array<'all' | ProjectStatus>;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  projects,
  statusFilter,
  onFilterChange,
  availableFilters = ['all', 'completed', 'processing', 'draft', 'failed'],
}) => {
  return (
    <div
      role="group"
      aria-label="Filter projects by status"
      className="filter-bar-group"
      style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}
    >
      {availableFilters.map((filter) => {
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
            aria-pressed={isActive}
            className={`badge filter-pill ${isActive ? 'active' : ''}`}
            style={{
              border: isActive ? '1px solid #111827' : '1px solid rgba(0, 0, 0, 0.1)',
              backgroundColor: isActive ? '#111827' : '#FFFFFF',
              color: isActive ? '#FFFFFF' : 'rgba(0, 0, 0, 0.7)',
              cursor: 'pointer',
              textTransform: 'capitalize',
              padding: '6px 12px',
              fontSize: 'var(--text-control)',
              fontWeight: isActive ? 600 : 500,
              borderRadius: '100px',
              transition: 'all 120ms ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>{filter === 'all' ? 'All' : filter}</span>
            <span
              style={{
                fontSize: 'var(--text-meta)',
                fontFamily: 'var(--font-sans)',
                opacity: isActive ? 0.9 : 0.6,
              }}
            >
              ({count})
            </span>
          </button>
        );
      })}
    </div>
  );
};
