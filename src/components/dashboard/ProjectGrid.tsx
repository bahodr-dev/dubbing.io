import React from 'react';
import type { Project } from '../../types';
import { ProjectCard } from './ProjectCard';
import { ProjectSkeleton } from './ProjectSkeleton';
import { DashboardEmptyState } from './DashboardEmptyState';

interface ProjectGridProps {
  projects: Project[];
  searchQuery?: string;
  isLoading?: boolean;
  totalCount?: number;
  onOpenProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenNewDub: () => void;
  onRenameProject?: (project: Project) => void;
  onRequestDeleteProject?: (project: Project) => void;
  onClearFilters?: () => void;
}

export const ProjectGrid: React.FC<ProjectGridProps> = ({
  projects,
  searchQuery,
  isLoading = false,
  totalCount,
  onOpenProject,
  onDeleteProject,
  onOpenNewDub,
  onRenameProject,
  onRequestDeleteProject,
  onClearFilters,
}) => {
  if (isLoading) {
    return <ProjectSkeleton viewMode="grid" />;
  }

  if (projects.length === 0) {
    const isTrueEmpty = (totalCount !== undefined ? totalCount === 0 : !searchQuery);
    return (
      <DashboardEmptyState
        type={isTrueEmpty ? 'true-empty' : 'no-results'}
        searchQuery={searchQuery}
        onOpenNewDub={onOpenNewDub}
        onClearFilters={onClearFilters}
      />
    );
  }

  return (
    <div
      className="project-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '16px',
      }}
    >
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onOpen={onOpenProject}
          onDelete={onDeleteProject}
          onRename={onRenameProject}
          onRequestDelete={onRequestDeleteProject}
        />
      ))}
    </div>
  );
};
