import React, { useState } from 'react';
import type { Project } from '../../types';
import { Play, Film } from 'lucide-react';
import { formatDuration, formatDate, truncateProjectTitle } from '../../utils/formatters';
import { ProjectProgress } from './ProjectProgress';
import { ProjectActionsMenu } from './ProjectActionsMenu';

interface ProjectCardProps {
  project: Project;
  onOpen: (project: Project) => void;
  onDelete: (projectId: string) => void;
  onRename?: (project: Project) => void;
  onRequestDelete?: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onOpen,
  onDelete,
  onRename,
  onRequestDelete,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(project);
    }
  };

  const getStatusBadgeClass = () => {
    switch (project.status) {
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
    if (onRequestDelete) {
      onRequestDelete(proj);
    } else {
      onDelete(proj.id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(project)}
      onKeyDown={handleKeyDown}
      className="card card-interactive project-card"
      aria-label={`Open project ${project.title}`}
      style={{
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        position: 'relative',
        minHeight: '328px',
      }}
    >
      {/* Thumbnail area */}
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 9',
          minHeight: '144px',
          backgroundColor: 'var(--black-10)',
          overflow: 'hidden',
        }}
      >
        {!imageFailed && project.thumbnailUrl ? (
          <img
            src={project.thumbnailUrl}
            alt=""
            onError={() => setImageFailed(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.04)',
              color: 'var(--black-40)',
            }}
          >
            <Film size={32} />
          </div>
        )}

        {/* Play overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity var(--transition-fast)',
          }}
          className="thumbnail-overlay"
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'var(--c-white)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Play size={18} fill="var(--c-black)" color="var(--c-black)" style={{ marginLeft: '2px' }} />
          </div>
        </div>

        {/* Status badge */}
        <span
          className={`badge ${getStatusBadgeClass()}`}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
          }}
        >
          {project.status}
        </span>

        {/* Duration */}
        <span
          className="badge mono"
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            color: 'var(--c-white)',
          }}
        >
          {formatDuration(project.duration)}
        </span>
      </div>

      {/* Card Body */}
      <div
        style={{
          padding: '14px 16px 12px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <div>
          <h3
            title={project.title}
            style={{
              fontSize: '15px',
              fontWeight: 700,
              minHeight: '18px',
              marginBottom: '8px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              color: '#111827',
            }}
          >
            {truncateProjectTitle(project.title)}
          </h3>

          {/* Language pair */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: 'var(--text-meta)',
              color: 'var(--black-60)',
              minHeight: '18px',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--c-black)' }}>
              {project.originalLanguage.toUpperCase()}
            </span>
            <span>→</span>
            <span style={{ fontWeight: 600, color: 'var(--c-black)' }}>
              {project.targetLanguage === 'uz' ? 'Uzbek' : project.targetLanguage.toUpperCase()}
            </span>
          </div>

          {/* Progress bar if processing */}
          {project.status === 'processing' && (
            <div style={{ marginTop: '12px' }}>
              <ProjectProgress progress={project.processingProgress} />
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: 'var(--border-light)',
              paddingTop: '10px',
            marginTop: 'auto',
          }}
        >
          <span style={{ fontSize: 'var(--text-meta)', color: 'var(--black-40)', fontFamily: 'var(--font-sans)' }}>
            {formatDate(project.updatedAt)}
          </span>

          <ProjectActionsMenu
            project={project}
            onOpen={onOpen}
            onRename={onRename ? onRename : () => {}}
            onDelete={handleDeleteTrigger}
          />
        </div>
      </div>
    </div>
  );
};
