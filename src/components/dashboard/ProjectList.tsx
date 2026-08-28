import React from 'react';
import type { Project } from '../../types';
import { Trash2, Search, Sparkles } from 'lucide-react';

interface ProjectListProps {
  projects: Project[];
  searchQuery?: string;
  onOpenProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenNewDub: () => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
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
        backgroundColor: 'var(--c-white)',
        border: 'var(--border-light)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--black-02)', borderBottom: 'var(--border-light)' }}>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: '12px' }}>PROJECT</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: '12px' }}>STATUS</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: '12px' }}>LANGUAGES</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: '12px' }}>DURATION</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: '12px' }}>UPDATED</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: '12px', textAlign: 'right' }}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project, idx) => (
            <tr
              key={project.id}
              onClick={() => onOpenProject(project)}
              style={{
                borderBottom: idx < projects.length - 1 ? 'var(--border-light)' : 'none',
                cursor: 'pointer',
                transition: 'background-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--black-02)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <img
                    src={project.thumbnailUrl}
                    alt=""
                    style={{
                      width: '36px',
                      height: '24px',
                      borderRadius: 'var(--radius-sm)',
                      objectFit: 'cover',
                      backgroundColor: 'var(--black-10)',
                    }}
                  />
                  <span>{project.title}</span>
                </div>
              </td>
              <td style={{ padding: '12px 16px' }}>
                <span
                  className={`badge ${
                    project.status === 'completed'
                      ? 'badge-completed'
                      : project.status === 'processing'
                      ? 'badge-processing'
                      : 'badge-draft'
                  }`}
                >
                  {project.status}
                </span>
              </td>
              <td style={{ padding: '12px 16px', color: 'var(--black-60)' }}>
                {project.originalLanguage.toUpperCase()} → {project.targetLanguage === 'uz' ? 'Uzbek' : project.targetLanguage.toUpperCase()}
              </td>
              <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--black-60)' }}>
                {Math.floor(project.duration)}s
              </td>
              <td style={{ padding: '12px 16px', color: 'var(--black-40)', fontSize: '12px' }}>
                {new Date(project.updatedAt).toLocaleDateString()}
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete project "${project.title}"?`)) {
                      onDeleteProject(project.id);
                    }
                  }}
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '4px', color: 'var(--black-40)' }}
                  title="Delete project"
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
