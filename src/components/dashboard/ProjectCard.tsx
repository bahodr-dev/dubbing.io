import React from 'react';
import type { Project } from '../../types';
import { Play, Trash2 } from 'lucide-react';

interface ProjectCardProps {
  project: Project;
  onOpen: (project: Project) => void;
  onDelete: (projectId: string) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ project, onOpen, onDelete }) => {
  return (
    <div
      onClick={() => onOpen(project)}
      className="card card-interactive"
      style={{
        padding: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Thumbnail area */}
      <div
        style={{
          position: 'relative',
          height: '160px',
          backgroundColor: 'var(--black-10)',
          overflow: 'hidden',
        }}
      >
        <img
          src={project.thumbnailUrl}
          alt={project.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />

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
          className={`badge ${
            project.status === 'completed'
              ? 'badge-completed'
              : project.status === 'processing'
              ? 'badge-processing'
              : 'badge-draft'
          }`}
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
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'var(--c-white)',
          }}
        >
          {Math.floor(project.duration)}s
        </span>
      </div>

      {/* Card Body */}
      <div
        style={{
          padding: '16px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 700,
              marginBottom: '6px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {project.title}
          </h3>

          {/* Language pair */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--black-60)',
              marginBottom: '12px',
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
        </div>

        {/* Card Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: 'var(--border-light)',
            paddingTop: '12px',
            marginTop: '4px',
          }}
        >
          <span style={{ fontSize: '11px', color: 'var(--black-40)' }}>
            {new Date(project.updatedAt).toLocaleDateString()}
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete project "${project.title}"?`)) {
                onDelete(project.id);
              }
            }}
            className="btn btn-ghost btn-sm"
            style={{ padding: '4px', color: 'var(--black-40)' }}
            title="Delete project"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
