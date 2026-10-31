import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import type { NewDubOptions, Project, ProjectStatus, Voice, ProjectLoadState } from '../types';
import { VOICES } from '../data/voices';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { PricingView } from './PricingView';
import { DashboardSidebar } from '../components/dashboard/DashboardSidebar';
import type { DashboardTab } from '../components/dashboard/DashboardSidebar';
import { WorkspaceCreator } from '../components/dashboard/WorkspaceCreator';
import { ProjectGrid } from '../components/dashboard/ProjectGrid';
import { ProjectList } from '../components/dashboard/ProjectList';
import { ProjectToolbar } from '../components/dashboard/ProjectToolbar';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { RenameProjectDialog } from '../components/dashboard/RenameProjectDialog';
import { DeleteProjectDialog } from '../components/dashboard/DeleteProjectDialog';
import { DashboardErrorState } from '../components/dashboard/DashboardErrorState';
import { VoicesExplorer } from '../components/dashboard/VoicesExplorer';
import { formatDuration, truncateProjectTitle } from '../utils/formatters';
import { ProjectSkeleton } from '../components/dashboard/ProjectSkeleton';
import { Sparkles, Search, ArrowRight, Link2, Film } from 'lucide-react';

interface DashboardViewProps {
  projects: Project[];
  projectLoadState?: ProjectLoadState;
  onRetryLoadProjects?: () => void;
  onOpenProject: (project: Project) => void;
  onCreateProject?: (project: Project, options: NewDubOptions) => void | Promise<void>;
  onOpenNewDub: () => void;
  onSelectPlan?: (plan: string) => void;
  onDeleteProject: (projectId: string) => void | Promise<void>;
  onRenameProject?: (projectId: string, newTitle: string) => void | Promise<void>;
}

const VALID_TABS: DashboardTab[] = ['home', 'recent', 'completed', 'draft', 'voices', 'gifts', 'pricing'];

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  projectLoadState = 'success',
  onRetryLoadProjects,
  onOpenProject,
  onCreateProject,
  onOpenNewDub,
  onSelectPlan,
  onDeleteProject,
  onRenameProject,
}) => {
  const { showToast } = useToast();
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // Resolve active tab from URL route params or location pathname
  const activeTab: DashboardTab = useMemo(() => {
    if (tab && VALID_TABS.includes(tab as DashboardTab)) {
      return tab as DashboardTab;
    }
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments[0] === 'dashboard' && segments[1]) {
      const seg = segments[1].toLowerCase() as DashboardTab;
      if (VALID_TABS.includes(seg)) {
        return seg;
      }
    }
    return 'home';
  }, [tab, location.pathname]);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [recentSearch, setRecentSearch] = useState('');
  const [voiceList, setVoiceList] = useState<Voice[]>(VOICES);

  // Dialog states
  const [projectToRename, setProjectToRename] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

  // Persist view mode to localStorage safely
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('dubla_uz_view_mode');
      if (saved === 'grid' || saved === 'list') {
        return saved;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 'grid';
  });

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('dubla_uz_view_mode', mode);
    } catch {
      // Ignore
    }
  };

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
  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return projects.filter((proj) => {
      const matchesSearch =
        !query ||
        proj.title.toLowerCase().includes(query) ||
        proj.originalLanguage.toLowerCase().includes(query) ||
        proj.targetLanguage.toLowerCase().includes(query);

      if (activeTab === 'completed') return matchesSearch && proj.status === 'completed';
      if (activeTab === 'draft') return matchesSearch && proj.status === 'draft';

      const matchesStatus = statusFilter === 'all' || proj.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, activeTab, statusFilter]);

  // Filter projects for the active tab scope (without search or status filter applied)
  const scopedTabProjects = useMemo(() => {
    if (activeTab === 'completed') return projects.filter((p) => p.status === 'completed');
    if (activeTab === 'draft') return projects.filter((p) => p.status === 'draft');
    return projects;
  }, [projects, activeTab]);

  // Recent dubs on Home: sorted by updatedAt descending, capped at 4
  const recentDubs = useMemo(() => {
    const sorted = [...projects].sort((a, b) => {
      const timeA = new Date(a.updatedAt).getTime() || 0;
      const timeB = new Date(b.updatedAt).getTime() || 0;
      return timeB - timeA;
    });

    const query = recentSearch.trim().toLowerCase();
    if (!query) return sorted.slice(0, 4);

    return sorted
      .filter(
        (p) =>
          p.title.toLowerCase().includes(query) ||
          p.originalLanguage.toLowerCase().includes(query) ||
          p.targetLanguage.toLowerCase().includes(query)
      )
      .slice(0, 4);
  }, [projects, recentSearch]);

  const handleProjectCreated = async (newProj: Project, options: NewDubOptions) => {
    if (onCreateProject) {
      await onCreateProject(newProj, options);
    } else {
      await onOpenProject(newProj);
    }
  };

  const handleTabChangeWithReset = (newTab: DashboardTab) => {
    setSearchQuery('');
    setStatusFilter('all');
    if (newTab === 'recent') {
      handleViewModeChange('grid');
    }
    if (newTab === 'home') {
      navigate('/dashboard');
    } else {
      navigate(`/dashboard/${newTab}`);
    }
  };

  const prevTabRef = useRef(activeTab);

  // Synchronize filter resets and view mode whenever activeTab updates (e.g. browser back/forward)
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      prevTabRef.current = activeTab;
      setSearchQuery('');
      setStatusFilter('all');
      if (activeTab === 'recent') {
        handleViewModeChange('grid');
      }
    }
  }, [activeTab]);

  const isLoading = projectLoadState === 'loading';
  const isError = projectLoadState === 'error';

  return (
    <div className="dashboard-shell" style={{ backgroundColor: 'var(--c-white)', minHeight: 'calc(100vh - 68px)', display: 'flex' }}>
      {/* Sidebar Rail (desktop) and Off-Canvas Drawer (tablet/mobile) */}
      <DashboardSidebar
        activeTab={activeTab}
        onTabChange={handleTabChangeWithReset}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        projects={projects}
        isMobileDrawerOpen={isMobileDrawerOpen}
        onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
      />

      {/* Main Content Area */}
      <main className="dashboard-main" style={{ flex: 1, padding: '32px', overflowY: 'auto', minWidth: 0 }}>
        {/* Non-blocking error banner if we have cached data but sync failed */}
        {activeTab !== 'pricing' && isError && projects.length > 0 && onRetryLoadProjects && (
          <DashboardErrorState variant="banner" onRetry={onRetryLoadProjects} />
        )}

        {/* Full error state if sync failed and no cached data exists */}
        {activeTab !== 'pricing' && isError && projects.length === 0 && onRetryLoadProjects ? (
          <DashboardErrorState variant="full" onRetry={onRetryLoadProjects} />
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 1. HOME VIEW (Dubbing Studio Workspace Creator & Recent Sessions)         */}
            {/* ========================================================================= */}
            {activeTab === 'home' && (
              <div className="dashboard-home" style={{ maxWidth: '960px', margin: '0 auto', animation: 'fadeIn 180ms ease' }}>
                <DashboardHeader
                  title="Start new dubbing"
                  description="Upload your video or audio. We'll handle the neural voice cloning & sync."
                  onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
                />

                {/* Workspace Creator Panel */}
                <WorkspaceCreator
                  voices={voiceList}
                  onProjectCreated={handleProjectCreated}
                  onShowToast={showToast}
                />

                {/* Recent Dubs Section */}
                <div style={{ marginTop: '36px' }}>
                  {/* Header Row */}
                  <div className="recent-dubs-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div>
                      <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', margin: 0 }}>
                        Recent dubs
                      </h2>
                      <p style={{ fontSize: 'var(--text-body)', color: 'rgba(0, 0, 0, 0.5)', marginTop: '2px', marginBottom: 0 }}>
                        Recently updated projects in your workspace.
                      </p>
                    </div>

                    <div className="recent-dubs-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {/* Search Input */}
                      <div className="recent-dubs-search" style={{ position: 'relative', width: '200px' }}>
                        <Search
                          size={14}
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            left: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'rgba(0, 0, 0, 0.4)',
                            pointerEvents: 'none',
                          }}
                        />
                        <input
                          type="text"
                          aria-label="Search recent dubs"
                          value={recentSearch}
                          onChange={(e) => setRecentSearch(e.target.value)}
                          placeholder="Search recent dubs"
                          style={{
                            width: '100%',
                            padding: '6px 10px 6px 30px',
                            borderRadius: '8px',
                            border: '1px solid rgba(0, 0, 0, 0.12)',
                            fontSize: 'var(--text-input)',
                            backgroundColor: '#ffffff',
                            outline: 'none',
                          }}
                        />
                      </div>

                      {/* View All Button */}
                      <button
                        type="button"
                        onClick={() => handleTabChangeWithReset('recent')}
                        className="btn btn-secondary btn-sm"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 12px',
                          fontSize: 'var(--text-control)',
                          fontWeight: 600,
                        }}
                      >
                        <span>View all</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Desktop Table Headers */}
                  <div
                    className="recent-dubs-header"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
                      gap: '12px',
                      padding: '8px 12px',
                      fontSize: 'var(--text-meta)',
                      fontWeight: 600,
                      color: 'rgba(0, 0, 0, 0.45)',
                      borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
                    }}
                  >
                    <div>Name</div>
                    <div>Language</div>
                    <div>Duration</div>
                    <div>Status</div>
                  </div>

                  {/* Rows */}
                  {isLoading && projects.length === 0 ? <ProjectSkeleton viewMode="list" /> : projects.length === 0 ? (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '50px 20px',
                        color: 'rgba(0, 0, 0, 0.45)',
                        border: '1px dashed rgba(0, 0, 0, 0.1)',
                        borderRadius: '12px',
                        marginTop: '8px',
                      }}
                    >
                      <Link2 size={24} style={{ margin: '0 auto 10px', display: 'block', color: 'rgba(0, 0, 0, 0.35)' }} />
                      <div style={{ fontSize: 'var(--text-control)', fontWeight: 600, color: 'rgba(0, 0, 0, 0.7)' }}>
                        No dubs in this workspace
                      </div>
                      <div style={{ fontSize: 'var(--text-meta)', color: 'rgba(0, 0, 0, 0.45)', marginTop: '2px' }}>
                        Configure a media source and target language above to begin.
                      </div>
                    </div>
                  ) : recentDubs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 20px', color: 'rgba(0, 0, 0, 0.45)' }}>
                      <div style={{ fontSize: 'var(--text-control)', fontWeight: 600, color: 'rgba(0, 0, 0, 0.7)' }}>
                        No matching dubs found
                      </div>
                      <div style={{ fontSize: 'var(--text-meta)', color: 'rgba(0, 0, 0, 0.45)', marginTop: '2px' }}>
                        Try a different search keyword.
                      </div>
                    </div>
                  ) : (
                    <div className="recent-dubs-list">
                      {recentDubs.map((p) => (
                        <div
                          key={p.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Open recent dub ${p.title}`}
                          onClick={() => onOpenProject(p)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onOpenProject(p);
                            }
                          }}
                          className="recent-dub-row"
                          style={{
                            padding: '12px',
                            fontSize: 'var(--text-control)',
                            fontWeight: 500,
                            color: '#111827',
                            borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'background-color 120ms ease',
                            borderRadius: '8px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '22px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(0,0,0,0.08)',
                                overflow: 'hidden',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {p.thumbnailUrl ? (
                                <img src={p.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <Film size={14} color="var(--black-40)" />
                              )}
                            </div>
                            <span
                              title={p.title}
                              style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                fontWeight: 600,
                              }}
                            >
                              {truncateProjectTitle(p.title)}
                            </span>
                          </div>
                          <div style={{ color: 'rgba(0, 0, 0, 0.65)' }}>
                            {p.originalLanguage.toUpperCase()} → {p.targetLanguage === 'uz' ? 'Uzbek' : p.targetLanguage.toUpperCase()}
                          </div>
                          <div style={{ color: 'rgba(0, 0, 0, 0.65)', fontFamily: 'var(--font-sans)' }}>
                            {formatDuration(p.duration)}
                          </div>
                          <div>
                            <span
                              className={`badge ${
                                p.status === 'completed'
                                  ? 'badge-completed'
                                  : p.status === 'processing'
                                  ? 'badge-processing'
                                  : p.status === 'failed'
                                  ? 'badge-failed'
                                  : 'badge-draft'
                              }`}
                            >
                              {p.status}
                            </span>
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
              <div className="dashboard-projects-view">
                <DashboardHeader
                  title={
                    activeTab === 'recent'
                      ? 'Recent Projects'
                      : activeTab === 'completed'
                      ? 'Completed Dubs'
                      : 'Drafts'
                  }
                  description={
                    activeTab === 'recent'
                      ? 'Manage, review, and export all your multilingual video translations'
                      : activeTab === 'completed'
                      ? 'All studio-ready exported and finished dubbing projects'
                      : 'Unfinished dubbing projects and editing sessions in progress'
                  }
                  onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
                  primaryAction={
                    <button
                      type="button"
                      onClick={onOpenNewDub}
                      data-dialog-return-focus
                      className="btn btn-primary"
                      style={{
                        padding: '9px 18px',
                        fontWeight: 600,
                        fontSize: 'var(--text-control)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <Sparkles size={15} />
                      <span>New project</span>
                    </button>
                  }
                />

                {/* Toolbar: Search and filters */}
                <ProjectToolbar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  totalProjects={scopedTabProjects}
                  showStatusFilter={activeTab === 'recent'}
                  availableFilters={['all', 'completed', 'processing', 'draft', 'failed']}
                />

                {/* Content View: Grid or List */}
                {viewMode === 'grid' ? (
                  <ProjectGrid
                    projects={filteredProjects}
                    searchQuery={searchQuery}
                    isLoading={isLoading && projects.length === 0}
                    totalCount={scopedTabProjects.length}
                    onOpenProject={onOpenProject}
                    onDeleteProject={onDeleteProject}
                    onOpenNewDub={onOpenNewDub}
                    onRenameProject={(p) => setProjectToRename(p)}
                    onRequestDeleteProject={(p) => setProjectToDelete(p)}
                    onClearFilters={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                    }}
                  />
                ) : (
                  <ProjectList
                    projects={filteredProjects}
                    searchQuery={searchQuery}
                    isLoading={isLoading && projects.length === 0}
                    totalCount={scopedTabProjects.length}
                    onOpenProject={onOpenProject}
                    onDeleteProject={onDeleteProject}
                    onOpenNewDub={onOpenNewDub}
                    onRenameProject={(p) => setProjectToRename(p)}
                    onRequestDeleteProject={(p) => setProjectToDelete(p)}
                  />
                )}
              </div>
            )}

            {/* ========================================================================= */}
            {/* 3. VOICES STUDIO EXPLORER                                                 */}
            {/* ========================================================================= */}
            {activeTab === 'pricing' && (
              <div style={{ maxWidth: '1200px', margin: '0 auto', animation: 'fadeIn 180ms ease' }}>
                <DashboardHeader
                  title="Pricing & Plans"
                  description="Choose the plan that matches your production scale."
                  onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
                />
                <PricingView embedded onSelectPlan={onSelectPlan ?? (() => navigate('/pricing'))} />
              </div>
            )}

            {activeTab === 'voices' && (
              <div>
                <DashboardHeader
                  title="Voices Studio"
                  description="Explore and preview neural voice models across multiple languages."
                  onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
                  primaryAction={
                    <button
                      type="button"
                      onClick={onOpenNewDub}
                      className="btn btn-primary"
                      style={{ padding: '9px 18px', fontWeight: 600, fontSize: 'var(--text-control)', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Sparkles size={15} />
                      <span>New dub</span>
                    </button>
                  }
                />
                <VoicesExplorer voices={voiceList} onOpenNewDub={onOpenNewDub} />
              </div>
            )}

            {/* ========================================================================= */}
            {/* 4. GIFTS & REFERRAL REWARDS                                               */}
            {/* ========================================================================= */}
            {activeTab === 'gifts' && (
              <div style={{ maxWidth: '800px', margin: '0 auto', animation: 'fadeIn 180ms ease' }}>
                <DashboardHeader
                  title="Gifts & Referral Rewards"
                  description="Share your personal link to earn free video dubbing minutes for every friend who joins."
                  onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
                />

                <div className="gifts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '20px', marginBottom: '32px' }}>
                  {/* Card 1: Referral Link */}
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0, 0, 0, 0.08)', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)' }}>
                    <div style={{ fontSize: '28px', marginBottom: '12px' }}>🎁</div>
                    <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>
                      Give 15m, Get 15m
                    </h3>
                    <p style={{ fontSize: 'var(--text-body)', color: 'rgba(0, 0, 0, 0.6)', lineHeight: 1.5, marginBottom: '16px' }}>
                      When your friend signs up using your code, both of you instantly get 15 free video dubbing minutes.
                    </p>

                    <div className="referral-copy" style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        readOnly
                        aria-label="Your referral link"
                        value="https://dubla.uz/ref/GIFT-782"
                        style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(0, 0, 0, 0.12)', fontSize: 'var(--text-input)', backgroundColor: 'rgba(0, 0, 0, 0.02)', fontWeight: 600 }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText('https://dubla.uz/ref/GIFT-782');
                          showToast('Referral link copied to clipboard!');
                        }}
                        className="btn btn-primary"
                        style={{ padding: '10px 16px', fontSize: 'var(--text-control)', fontWeight: 600 }}
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Card 2: Redeem Promo Code */}
                  <div style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0, 0, 0, 0.08)', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)' }}>
                    <div style={{ fontSize: '28px', marginBottom: '12px' }}>🎟️</div>
                    <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>
                      Redeem Gift / Promo Code
                    </h3>
                    <p style={{ fontSize: 'var(--text-body)', color: 'rgba(0, 0, 0, 0.6)', lineHeight: 1.5, marginBottom: '16px' }}>
                      Have a promotional voucher or gift coupon? Enter it below to activate extra minutes.
                    </p>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Enter code (e.g. WELCOME2026)"
                        aria-label="Gift or promo code"
                        id="promo-code-input"
                        style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(0, 0, 0, 0.12)', fontSize: 'var(--text-input)' }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const input = document.getElementById('promo-code-input') as HTMLInputElement | null;
                          if (input && input.value.trim()) {
                            showToast(`Promo code "${input.value.trim()}" activated! +10 minutes added.`);
                            input.value = '';
                          } else {
                            showToast('Please enter a valid gift code.');
                          }
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '10px 16px', fontSize: 'var(--text-control)', fontWeight: 600 }}
                      >
                        Redeem
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Accessible Custom Rename Project Dialog */}
      <RenameProjectDialog
        project={projectToRename}
        isOpen={!!projectToRename}
        onClose={() => setProjectToRename(null)}
        onRename={async (id, newTitle) => {
          if (onRenameProject) {
            await onRenameProject(id, newTitle);
          }
        }}
      />

      {/* Accessible Custom Delete Confirmation Dialog */}
      <DeleteProjectDialog
        project={projectToDelete}
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onDelete={async (id) => {
          await onDeleteProject(id);
        }}
      />
    </div>
  );
};
