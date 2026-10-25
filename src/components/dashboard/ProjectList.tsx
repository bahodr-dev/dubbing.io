import React, { useState } from 'react';
import type { Project } from '../../types';
import { Film } from 'lucide-react';
import { formatDuration, formatDate, truncateProjectTitle } from '../../utils/formatters';
import { ProjectProgress } from './ProjectProgress';
import { ProjectActionsMenu } from './ProjectActionsMenu';
import { ProjectSkeleton } from './ProjectSkeleton';
import { DashboardEmptyState } from './DashboardEmptyState';

interface ProjectListProps {
  projects: Project[];
  searchQuery?: string;
  isLoading?: boolean;
  totalCount?: number;
  onOpenProject: (project: Project) => void;
  onDeleteProject: (projectId: string) => void;
  onOpenNewDub: () => void;
  onRenameProject?: (project: Project) => void;
  onRequestDeleteProject?: (project: Project) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  searchQuery,
  isLoading = false,
  totalCount,
  onOpenProject,
  onDeleteProject,
  onOpenNewDub,
  onRenameProject,
  onRequestDeleteProject,
}) => {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  if (isLoading) {
    return <ProjectSkeleton viewMode="list" />;
  }

  if (projects.length === 0) {
    const isTrueEmpty = (totalCount !== undefined ? totalCount === 0 : !searchQuery);
    return (
      <DashboardEmptyState
        type={isTrueEmpty ? 'true-empty' : 'no-results'}
        searchQuery={searchQuery}
        onOpenNewDub={onOpenNewDub}
      />
    );
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'badge-completed';
      case 'processing':
        return 'badge-processing';
      case 'failed':
        return 'badge-failed';
      case 'draft':
      default:
        return 'badge-draft';
    }
  };

  const handleDeleteTrigger = (proj: Project) => {
    if (onRequestDeleteProject) {
      onRequestDeleteProject(proj);
    } else {
      onDeleteProject(proj.id);
    }
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, project: Project) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpenProject(project);
    }
  };

  return (
    <div
      className="project-list-wrapper"
      style={{
        backgroundColor: 'var(--c-white)',
        border: 'var(--border-light)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {/* Desktop Table View (hidden on small mobile screens via CSS) */}
      <table className="project-list-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--text-control)' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--black-02)', borderBottom: 'var(--border-light)' }}>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: 'var(--text-control)' }}>PROJECT</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: 'var(--text-control)' }}>STATUS</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: 'var(--text-control)' }}>LANGUAGES</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: 'var(--text-control)' }}>DURATION</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: 'var(--text-control)' }}>UPDATED</th>
            <th style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--black-60)', fontSize: 'var(--text-control)', textAlign: 'right' }}>ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project, idx) => (
            <tr
              key={project.id}
              tabIndex={0}
              role="button"
              aria-label={`Open project ${project.title}`}
              onClick={() => onOpenProject(project)}
              onKeyDown={(e) => handleRowKeyDown(e, project)}
              className="project-list-row"
              style={{
                borderBottom: idx < projects.length - 1 ? 'var(--border-light)' : 'none',
                cursor: 'pointer',
                transition: 'background-color var(--transition-fast)',
              }}
            >
              <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '24px',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      backgroundColor: 'var(--black-10)',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {!failedImages[project.id] && project.thumbnailUrl ? (
                      <img
                        src={project.thumbnailUrl}
                        alt=""
                        onError={() => setFailedImages((prev) => ({ ...prev, [project.id]: true }))}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <Film size={14} color="var(--black-40)" />
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <span className="project-list-title" title={project.title} style={{ color: '#111827', fontWeight: 600 }}>{truncateProjectTitle(project.title)}</span>
                    {project.status === 'processing' && (
                      <div style={{ width: '120px', marginTop: '2px' }}>
                        <ProjectProgress progress={project.processingProgress} showLabel={false} />
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td style={{ padding: '12px 16px' }}>
                <span className={`badge ${getStatusBadgeClass(project.status)}`}>
                  {project.status}
                </span>
              </td>
              <td style={{ padding: '12px 16px', color: 'var(--black-60)' }}>
                {project.originalLanguage.toUpperCase()} → {project.targetLanguage === 'uz' ? 'Uzbek' : project.targetLanguage.toUpperCase()}
              </td>
              <td style={{ padding: '12px 16px', fontFamily: 'var(--font-sans)', color: 'var(--black-60)' }}>
                {formatDuration(project.duration)}
              </td>
              <td style={{ padding: '12px 16px', color: 'var(--black-40)', fontSize: 'var(--text-meta)', fontFamily: 'var(--font-sans)' }}>
                {formatDate(project.updatedAt)}
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                <ProjectActionsMenu
                  project={project}
                  onOpen={onOpenProject}
                  onRename={onRenameProject ? onRenameProject : () => {}}
                  onDelete={handleDeleteTrigger}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile Card List View (displayed on <= 768px via CSS) */}
      <div className="project-list-cards">
        {projects.map((project, idx) => (
          <div
            key={project.id}
            tabIndex={0}
            role="button"
            aria-label={`Open project ${project.title}`}
            onClick={() => onOpenProject(project)}
            onKeyDown={(e) => handleRowKeyDown(e, project)}
            className="project-list-mobile-card"
            style={{
              padding: '14px 16px',
              borderBottom: idx < projects.length - 1 ? '1px solid rgba(0, 0, 0, 0.08)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  style={{
                    width: '40px',
                    height: '28px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    backgroundColor: 'var(--black-10)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {!failedImages[project.id] && project.thumbnailUrl ? (
                    <img
                      src={project.thumbnailUrl}
                      alt=""
                      onError={() => setFailedImages((prev) => ({ ...prev, [project.id]: true }))}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Film size={16} color="var(--black-40)" />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div title={project.title} style={{ fontWeight: 600, fontSize: '14px', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {truncateProjectTitle(project.title)}
                  </div>
                  <div style={{ fontSize: 'var(--text-meta)', color: 'var(--black-60)', marginTop: '1px' }}>
                    {project.originalLanguage.toUpperCase()} → {project.targetLanguage === 'uz' ? 'Uzbek' : project.targetLanguage.toUpperCase()}
                  </div>
                </div>
              </div>

              <ProjectActionsMenu
                project={project}
                onOpen={onOpenProject}
                onRename={onRenameProject ? onRenameProject : () => {}}
                onDelete={handleDeleteTrigger}
              />
            </div>

            {project.status === 'processing' && (
              <div>
                <ProjectProgress progress={project.processingProgress} />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 'var(--text-meta)', color: 'var(--black-60)', paddingTop: '6px' }}>
              <span className={`badge ${getStatusBadgeClass(project.status)}`}>
                {project.status}
              </span>
              <div style={{ display: 'flex', gap: '10px', fontFamily: 'var(--font-sans)' }}>
                <span>{formatDuration(project.duration)}</span>
                <span>•</span>
                <span>{formatDate(project.updatedAt)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
