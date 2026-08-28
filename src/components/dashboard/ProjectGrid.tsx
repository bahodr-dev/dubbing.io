import React from 'react';
import type { Project } from '../../types';
import { ProjectCard } from './ProjectCard';
import { Search, Sparkles } from 'lucide-react';

interface ProjectGridProps {
  projects: Project[];
  searchQuery?: string;
  onOpenProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenNewDub: () => void;
}

export const ProjectGrid: React.FC<ProjectGridProps> = ({
  projects,
  searchQuery,
  onOpenProject,
  onDeleteProject,
  onOpenNewDub,
}) => {
  if (projects.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '80px 20px',
          border: '1px dashed var(--black-20)',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--black-02)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'var(--black-05)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <Search size={22} color="var(--black-40)" />
        </div>
        <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>No projects found</h3>
        <p style={{ fontSize: '13px', color: 'var(--black-60)', marginBottom: '20px' }}>
          {searchQuery ? 'Try adjusting your search criteria' : 'Create your first AI dubbing project to get started'}
        </p>
        <button onClick={onOpenNewDub} className="btn btn-primary btn-sm">
          <Sparkles size={14} />
          <span>Start New Dub</span>
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px',
      }}
    >
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onOpen={onOpenProject}
          onDelete={onDeleteProject}
        />
      ))}
    </div>
  );
};
