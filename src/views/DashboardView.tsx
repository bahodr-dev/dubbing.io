import React, { useState } from 'react';
import type { Project, ProjectStatus } from '../types';
import { Plus, Search, Play, Trash2, LayoutGrid, List } from 'lucide-react';

interface DashboardViewProps {
  projects: Project[];
  onOpenProject: (project: Project) => void;
  onOpenNewDub: () => void;
  onDeleteProject: (projectId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  onOpenProject,
  onOpenNewDub,
  onDeleteProject,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredProjects = projects.filter(proj => {
    const matchesSearch = proj.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          proj.originalLanguage.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          proj.targetLanguage.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || proj.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ backgroundColor: 'var(--c-white)', minHeight: 'calc(100vh - 68px)', display: 'flex' }}>
      {/* Sidebar */}
      <aside style={{
        width: '260px',
        borderRight: 'var(--border-light)',
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: 'var(--black-02)',
      }}>
        <div>
          {/* Action button */}
          <button
            onClick={onOpenNewDub}
            className="btn btn-primary"
            style={{ width: '100%', marginBottom: '28px', padding: '11px', fontWeight: 600 }}
          >
            <Plus size={16} />
            New project
          </button>

          {/* Navigation Section */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--black-40)', marginBottom: '12px' }}>
              Workspace
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>
                <button
                  onClick={() => setStatusFilter('all')}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-xs)',
                    border: 'none',
                    background: statusFilter === 'all' ? 'var(--black-100)' : 'transparent',
                    color: statusFilter === 'all' ? 'var(--white-100)' : 'var(--black-80)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>All Projects</span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{projects.length}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setStatusFilter('completed')}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-xs)',
                    border: 'none',
                    background: statusFilter === 'completed' ? 'var(--black-100)' : 'transparent',
                    color: statusFilter === 'completed' ? 'var(--white-100)' : 'var(--black-80)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Completed Dubs</span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{projects.filter(p => p.status === 'completed').length}</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => setStatusFilter('draft')}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-xs)',
                    border: 'none',
                    background: statusFilter === 'draft' ? 'var(--black-100)' : 'transparent',
                    color: statusFilter === 'draft' ? 'var(--white-100)' : 'var(--black-80)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span>Drafts</span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{projects.filter(p => p.status === 'draft').length}</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Recent projects list */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--black-40)', marginBottom: '12px' }}>
              Recent Projects
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {projects.slice(0, 4).map(p => (
                <li key={p.id}>
                  <button
                    onClick={() => onOpenProject(p)}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 10px',
                      borderRadius: 'var(--radius-xs)',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--black-70)',
                      fontSize: '12.5px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--black-100)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--black-70)'}
                  >
                    • {p.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Sidebar Footer Account & Credits */}
        <div style={{
          borderTop: 'var(--border-light)',
          paddingTop: '16px',
        }}>
          <div style={{
            padding: '12px',
            backgroundColor: 'var(--c-white)',
            border: 'var(--border-light)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--black-60)', marginBottom: '6px' }}>
              <span>Monthly Studio Credits</span>
              <span className="mono" style={{ fontWeight: 600, color: 'var(--black-100)' }}>42 / 60 min</span>
            </div>
            <div style={{ height: '4px', backgroundColor: 'var(--black-10)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: '70%', height: '100%', backgroundColor: 'var(--black-100)' }}></div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: 'var(--radius-xs)',
              backgroundColor: 'var(--black-100)',
              color: 'var(--white-100)',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              B
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Bahodir S.</div>
              <div style={{ fontSize: '11px', color: 'var(--black-40)' }}>Creator Plan</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '36px 40px', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.04em' }}>
              Your projects
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--black-60)', marginTop: '4px' }}>
              Manage, edit, and export your translated and dubbed videos
            </p>
          </div>

          <button
            onClick={onOpenNewDub}
            className="btn btn-primary"
            style={{ padding: '10px 18px', fontWeight: 600 }}
          >
            <Plus size={16} />
            Create dub
          </button>
        </div>

        {/* Toolbar: Search, Filters, View toggle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '28px',
          paddingBottom: '20px',
          borderBottom: 'var(--border-light)',
        }}>
          {/* Search bar */}
          <div style={{ position: 'relative', width: '320px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--black-40)' }} />
            <input
              type="text"
              className="input"
              placeholder="Search projects by name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '36px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Filter pills */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {(['all', 'completed', 'draft'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ textTransform: 'capitalize' }}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', border: 'var(--border-light)', borderRadius: 'var(--radius-xs)', overflow: 'hidden' }}>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '6px 8px',
                  border: 'none',
                  background: viewMode === 'grid' ? 'var(--black-100)' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--white-100)' : 'var(--black-60)',
                  cursor: 'pointer',
                }}
                title="Grid view"
              >
                <LayoutGrid size={14} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                style={{
                  padding: '6px 8px',
                  border: 'none',
                  borderLeft: 'var(--border-light)',
                  background: viewMode === 'list' ? 'var(--black-100)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--white-100)' : 'var(--black-60)',
                  cursor: 'pointer',
                }}
                title="List view"
              >
                <List size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Projects Grid / List */}
        {filteredProjects.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '64px 20px',
            border: '1px dashed var(--black-20)',
            borderRadius: 'var(--radius-md)',
          }}>
            <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--black-100)', marginBottom: '8px' }}>
              No projects found
            </p>
            <p style={{ fontSize: '13px', color: 'var(--black-60)', marginBottom: '20px' }}>
              Upload your first video to start dubbing in Uzbek or 40+ other languages.
            </p>
            <button onClick={onOpenNewDub} className="btn btn-primary btn-sm">
              Create a new dub →
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '20px',
          }}>
            {filteredProjects.map(proj => (
              <div
                key={proj.id}
                className="card card-hover"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  cursor: 'pointer',
                }}
                onClick={() => onOpenProject(proj)}
              >
                {/* Thumbnail Header */}
                <div style={{
                  height: '160px',
                  position: 'relative',
                  backgroundColor: 'var(--black-100)',
                  overflow: 'hidden',
                }}>
                  <img
                    src={proj.thumbnailUrl}
                    alt={proj.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      opacity: 0.65,
                      filter: 'grayscale(100%)',
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-xs)',
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Play size={18} color="#000000" style={{ marginLeft: '2px' }} />
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
                    <span className={`badge ${proj.status === 'completed' ? 'badge-completed' : 'badge-draft'}`}>
                      {proj.status}
                    </span>
                  </div>

                  {/* Duration Tag */}
                  <div style={{
                    position: 'absolute',
                    bottom: '10px',
                    right: '12px',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 6px',
                    borderRadius: '2px',
                  }}>
                    {proj.duration}s
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '18px 20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {proj.title}
                  </h3>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 600,
                    marginBottom: '14px',
                    color: 'var(--black-80)',
                  }}>
                    <span>{proj.originalLanguage.toUpperCase()}</span>
                    <span>→</span>
                    <span style={{ backgroundColor: 'var(--black-10)', padding: '1px 6px', borderRadius: '2px' }}>
                      {proj.targetLanguage === 'uz' ? "Uzbek (O'zbek)" : proj.targetLanguage.toUpperCase()}
                    </span>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: 'var(--border-light)',
                    paddingTop: '12px',
                    fontSize: '12px',
                    color: 'var(--black-40)',
                  }}>
                    <span className="mono">
                      {new Date(proj.updatedAt).toLocaleDateString()}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteProject(proj.id);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--black-40)', cursor: 'pointer', padding: '4px' }}
                      title="Delete project"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div style={{
            border: 'var(--border-light)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--black-05)', borderBottom: 'var(--border-light)' }}>
                  <th style={{ padding: '12px 20px', fontWeight: 600 }}>Project Title</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Languages</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Duration</th>
                  <th style={{ padding: '12px 16px', fontWeight: 600 }}>Last Edited</th>
                  <th style={{ padding: '12px 20px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((proj, idx) => (
                  <tr
                    key={proj.id}
                    onClick={() => onOpenProject(proj)}
                    style={{
                      borderBottom: idx < filteredProjects.length - 1 ? 'var(--border-light)' : 'none',
                      cursor: 'pointer',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--black-02)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '14px 20px', fontWeight: 600, color: 'var(--black-100)' }}>
                      {proj.title}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className="mono" style={{ fontSize: '12px' }}>
                        {proj.originalLanguage.toUpperCase()} → {proj.targetLanguage.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className={`badge ${proj.status === 'completed' ? 'badge-completed' : 'badge-draft'}`}>
                        {proj.status}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--black-60)' }}>
                      {proj.duration}s
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--black-60)' }}>
                      {new Date(proj.updatedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteProject(proj.id);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--black-40)', cursor: 'pointer' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
};
