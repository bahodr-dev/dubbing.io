import React, { useState, useEffect } from 'react';
import type { Project, ProjectStatus, Voice } from '../types';
import { VOICES } from '../data/voices';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar';
import type { DashboardTab } from '../components/dashboard/DashboardSidebar';
import { WorkspaceCreator } from '../components/dashboard/WorkspaceCreator';
import { ProjectGrid } from '../components/dashboard/ProjectGrid';
import { ProjectList } from '../components/dashboard/ProjectList';
import { SearchBar } from '../components/dashboard/SearchBar';
import { FilterBar } from '../components/dashboard/FilterBar';
import { ViewModeToggle } from '../components/dashboard/ViewModeToggle';
import { VoicesExplorer } from '../components/dashboard/VoicesExplorer';
import { Sparkles, Search, ArrowRight, Link2 } from 'lucide-react';

interface DashboardViewProps {
  projects: Project[];
  onOpenProject: (project: Project) => void;
  onCreateProject?: (project: Project) => void;
  onOpenNewDub: () => void;
  onDeleteProject: (projectId: string) => void;
  onRenameProject?: (projectId: string, newTitle: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  onOpenProject,
  onCreateProject,
  onOpenNewDub,
  onDeleteProject,
}) => {
  const { showToast } = useToast();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [recentSearch, setRecentSearch] = useState('');
  const [voiceList, setVoiceList] = useState<Voice[]>(VOICES);

  // Fetch updated voice profiles from backend API on mount
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const res = await api.voices.list();
        if (res.voices && res.voices.length > 0) {
          setVoiceList(res.voices);
        }
      } catch (err) {
        console.warn('Loaded default voice profiles fallback:', err);
      }
    };
    loadVoices();
  }, []);

  // Filter projects according to search query, active tab, and status filter
  const filteredProjects = projects.filter((proj) => {
    const matchesSearch =
      proj.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proj.originalLanguage.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proj.targetLanguage.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === 'completed') return matchesSearch && proj.status === 'completed';
    if (activeTab === 'draft') return matchesSearch && proj.status === 'draft';

    const matchesStatus = statusFilter === 'all' || proj.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleProjectCreated = (newProj: Project) => {
    if (onCreateProject) {
      onCreateProject(newProj);
    } else {
      onOpenProject(newProj);
    }
  };

  return (
    <div style={{ backgroundColor: 'var(--c-white)', minHeight: 'calc(100vh - 68px)', display: 'flex' }}>
      {/* Collapsible Mini-Rail & Expanded Sidebar */}
      <DashboardSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        projects={projects}
      />

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '32px', overflowY: 'auto', minWidth: 0 }}>
        {/* ========================================================================= */}
        {/* 1. HOME VIEW (Dubbing Studio Workspace Creator & Recent Sessions)         */}
        {/* ========================================================================= */}
        {activeTab === 'home' && (
          <div style={{ maxWidth: '960px', margin: '0 auto', animation: 'fadeIn 180ms ease' }}>
            {/* Header */}
            <div style={{ marginBottom: '24px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>
                Start new dubbing
              </h1>
              <p style={{ fontSize: '13.5px', color: 'rgba(0, 0, 0, 0.55)', marginTop: '3px' }}>
                Upload your video or audio. We'll handle the neural voice cloning & sync.
              </p>
            </div>

            {/* Workspace Creator Panel */}
            <WorkspaceCreator
              voices={voiceList}
              onProjectCreated={handleProjectCreated}
              onShowToast={showToast}
            />

            {/* Recent Dubs Section */}
            <div>
              {/* Header Row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                    Recent dubs
                  </h2>
                  <p style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.5)', marginTop: '1px' }}>
                    Sources configured in this session.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {/* Search Input */}
                  <div style={{ position: 'relative', width: '200px' }}>
                    <Search
                      size={14}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'rgba(0, 0, 0, 0.4)',
                      }}
                    />
                    <input
                      type="text"
                      value={recentSearch}
                      onChange={(e) => setRecentSearch(e.target.value)}
                      placeholder="Search recent dubs"
                      style={{
                        width: '100%',
                        padding: '6px 10px 6px 30px',
                        borderRadius: '8px',
                        border: '1px solid rgba(0, 0, 0, 0.12)',
                        fontSize: '12.5px',
                        backgroundColor: '#ffffff',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* View All Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('recent');
                      setStatusFilter('all');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      border: '1px solid rgba(0, 0, 0, 0.12)',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      backgroundColor: '#ffffff',
                      color: '#111827',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  >
                    <span>View all</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>

              {/* Table Headers */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  padding: '8px 12px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'rgba(0, 0, 0, 0.45)',
                  borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                }}
              >
                <div>Name</div>
                <div>Language</div>
                <div>Duration</div>
                <div>Format</div>
              </div>

              {/* Rows */}
              {projects.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '50px 20px',
                    color: 'rgba(0, 0, 0, 0.45)',
                  }}
                >
                  <Link2 size={24} style={{ margin: '0 auto 10px', display: 'block', color: 'rgba(0, 0, 0, 0.35)' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(0, 0, 0, 0.7)' }}>
                    No dubs in this session
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.45)', marginTop: '2px' }}>
                    Add a source and target language above to begin.
                  </div>
                </div>
              ) : (
                <div>
                  {projects
                    .filter(
                      (p) =>
                        p.title.toLowerCase().includes(recentSearch.toLowerCase()) ||
                        p.targetLanguage.toLowerCase().includes(recentSearch.toLowerCase())
                    )
                    .slice(0, 4)
                    .map((p) => (
                      <div
                        key={p.id}
                        onClick={() => onOpenProject(p)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr 1fr',
                          padding: '12px',
                          fontSize: '13px',
                          fontWeight: 500,
                          color: '#111827',
                          borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'background-color 120ms ease',
                          borderRadius: '6px',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.02)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: '28px',
                              height: '20px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(0,0,0,0.08)',
                              overflow: 'hidden',
                              flexShrink: 0,
                            }}
                          >
                            <img src={p.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <span
                            style={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontWeight: 600,
                            }}
                          >
                            {p.title}
                          </span>
                        </div>
                        <div style={{ color: 'rgba(0, 0, 0, 0.65)' }}>
                          {p.originalLanguage.toUpperCase()} → {p.targetLanguage === 'uz' ? 'Uzbek' : p.targetLanguage.toUpperCase()}
                        </div>
                        <div style={{ color: 'rgba(0, 0, 0, 0.65)', fontFamily: 'monospace' }}>
                          {Math.floor(p.duration)}s
                        </div>
                        <div style={{ color: 'rgba(0, 0, 0, 0.65)' }}>
                          MP4 / Video
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. PROJECTS MANAGEMENT (Recent / Completed / Drafts)                      */}
        {/* ========================================================================= */}
        {(activeTab === 'recent' || activeTab === 'completed' || activeTab === 'draft') && (
          <div>
            {/* Section Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 700 }}>
                  {activeTab === 'recent' && 'Recent Projects'}
                  {activeTab === 'completed' && 'Completed Dubs'}
                  {activeTab === 'draft' && 'Drafts'}
                </h1>
                <p style={{ fontSize: '13px', color: 'var(--black-60)', marginTop: '2px' }}>
                  {activeTab === 'recent' && 'Manage, review, and export all your multilingual video translations'}
                  {activeTab === 'completed' && 'All studio-ready exported and finished dubbing projects'}
                  {activeTab === 'draft' && 'Unfinished dubbing projects and editing sessions in progress'}
                </p>
              </div>

              <button
                onClick={onOpenNewDub}
                className="btn btn-primary"
                style={{
                  padding: '9px 18px',
                  fontWeight: 600,
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Sparkles size={15} />
                <span>New project</span>
              </button>
            </div>

            {/* Toolbar: Search, Filters, View toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                marginBottom: '20px',
              }}
            >
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search by title or language..."
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {activeTab === 'recent' && (
                  <FilterBar
                    projects={projects}
                    statusFilter={statusFilter}
                    onFilterChange={setStatusFilter}
                  />
                )}

                <ViewModeToggle viewMode={viewMode} onToggle={setViewMode} />
              </div>
            </div>

            {/* Content View: Grid or List */}
            {viewMode === 'grid' ? (
              <ProjectGrid
                projects={filteredProjects}
                searchQuery={searchQuery}
                onOpenProject={onOpenProject}
                onDeleteProject={onDeleteProject}
                onOpenNewDub={onOpenNewDub}
              />
            ) : (
              <ProjectList
                projects={filteredProjects}
                searchQuery={searchQuery}
                onOpenProject={onOpenProject}
                onDeleteProject={onDeleteProject}
                onOpenNewDub={onOpenNewDub}
              />
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. VOICES STUDIO EXPLORER                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'voices' && (
          <VoicesExplorer voices={voiceList} onOpenNewDub={onOpenNewDub} />
        )}
      </main>
    </div>
  );
};
