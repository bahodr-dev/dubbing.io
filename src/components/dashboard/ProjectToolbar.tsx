import React from 'react';
import type { Project, ProjectStatus } from '../../types';
import { SearchBar } from './SearchBar';
import { FilterBar } from './FilterBar';
import { X } from 'lucide-react';

interface ProjectToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: 'all' | ProjectStatus;
  onStatusFilterChange: (filter: 'all' | ProjectStatus) => void;
  totalProjects: Project[];
  showStatusFilter?: boolean;
  availableFilters?: Array<'all' | ProjectStatus>;
}

export const ProjectToolbar: React.FC<ProjectToolbarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  totalProjects,
  showStatusFilter = true,
  availableFilters,
}) => {
  const isFiltered = searchQuery.trim().length > 0 || statusFilter !== 'all';

  const handleClearFilters = () => {
    onSearchChange('');
    onStatusFilterChange('all');
  };

  return (
    <div
      className="project-toolbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px',
      }}
    >
      <div
        className="project-toolbar-left"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          flex: 1,
          minWidth: '280px',
        }}
      >
        <SearchBar
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search by title or language..."
          width="320px"
        />

        <div className="project-toolbar-filters">
          {isFiltered && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="btn btn-ghost btn-sm project-toolbar-clear"
              style={{
                padding: '6px 10px',
                fontSize: 'var(--text-control)',
                fontWeight: 600,
                color: 'var(--black-60)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <X size={13} />
              <span>Clear filters</span>
            </button>
          )}

          {showStatusFilter && (
            <FilterBar
              projects={totalProjects}
              statusFilter={statusFilter}
              onFilterChange={onStatusFilterChange}
              availableFilters={availableFilters}
            />
          )}
        </div>
      </div>

    </div>
  );
};
