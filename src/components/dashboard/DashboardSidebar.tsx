import React from 'react';
import type { Project } from '../../types';
import {
  Home,
  Clock,
  CheckCircle2,
  FileEdit,
  Volume2,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export type DashboardTab = 'home' | 'recent' | 'completed' | 'draft' | 'voices';

interface DashboardSidebarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  projects: Project[];
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeTab,
  onTabChange,
  isSidebarOpen,
  onToggleSidebar,
  projects,
}) => {
  const completedCount = projects.filter((p) => p.status === 'completed').length;
  const draftCount = projects.filter((p) => p.status === 'draft').length;

  return (
    <aside
      style={{
        width: isSidebarOpen ? '260px' : '64px',
        minWidth: isSidebarOpen ? '260px' : '64px',
        borderRight: '1px solid rgba(0, 0, 0, 0.08)',
        padding: isSidebarOpen ? '20px 14px' : '20px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#FAFAFB',
        position: 'relative',
        zIndex: 50,
        transition:
          'width 240ms cubic-bezier(0.16, 1, 0.3, 1), min-width 240ms cubic-bezier(0.16, 1, 0.3, 1), padding 240ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          width: isSidebarOpen ? '232px' : '48px',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflowY: isSidebarOpen ? 'auto' : 'visible',
          overflowX: 'visible',
          paddingRight: isSidebarOpen ? '2px' : '0px',
        }}
      >
        {/* Top Bar with Workspace & Toggle */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isSidebarOpen ? 'space-between' : 'center',
            marginBottom: '14px',
            padding: isSidebarOpen ? '0 4px' : '0',
          }}
        >
          {isSidebarOpen ? (
            <>
              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'rgba(0, 0, 0, 0.4)',
                }}
              >
                Workspace
              </span>
              <button
                type="button"
                onClick={onToggleSidebar}
                className="btn btn-ghost btn-sm"
                style={{
                  padding: '4px',
                  color: 'rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Collapse sidebar"
              >
                <PanelLeftClose size={15} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="btn btn-ghost btn-sm"
              style={{
                padding: '6px',
                color: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}
              title="Expand sidebar"
            >
              <PanelLeftOpen size={17} />
            </button>
          )}
        </div>

        {/* Primary Navigation Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '24px' }}>
          {/* 1. Home */}
          <div className={!isSidebarOpen ? 'tooltip-trigger' : undefined}>
            <button
              type="button"
              onClick={() => onTabChange('home')}
              title={!isSidebarOpen ? 'Home' : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: isSidebarOpen ? '8px 12px' : '8px 0',
                justifyContent: isSidebarOpen ? 'flex-start' : 'center',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'home' ? 'rgba(0, 0, 0, 0.07)' : 'transparent',
                color: activeTab === 'home' ? '#000000' : 'rgba(0, 0, 0, 0.7)',
                fontSize: '13.5px',
                fontWeight: activeTab === 'home' ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              <Home
                size={17}
                strokeWidth={activeTab === 'home' ? 2 : 1.75}
                color={activeTab === 'home' ? '#000000' : 'rgba(0, 0, 0, 0.6)'}
              />
              {isSidebarOpen && <span>Home</span>}
            </button>
            {!isSidebarOpen && <div className="tooltip-content">Home</div>}
          </div>

          {/* 2. Recent Projects */}
          <div className={!isSidebarOpen ? 'tooltip-trigger' : undefined}>
            <button
              type="button"
              onClick={() => onTabChange('recent')}
              title={!isSidebarOpen ? `Recent projects (${projects.length})` : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isSidebarOpen ? 'space-between' : 'center',
                padding: isSidebarOpen ? '8px 12px' : '8px 0',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'recent' ? 'rgba(0, 0, 0, 0.07)' : 'transparent',
                color: activeTab === 'recent' ? '#000000' : 'rgba(0, 0, 0, 0.7)',
                fontSize: '13.5px',
                fontWeight: activeTab === 'recent' ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  justifyContent: isSidebarOpen ? 'flex-start' : 'center',
                }}
              >
                <Clock
                  size={17}
                  strokeWidth={activeTab === 'recent' ? 2 : 1.75}
                  color={activeTab === 'recent' ? '#000000' : 'rgba(0, 0, 0, 0.6)'}
                />
                {isSidebarOpen && <span>Recent projects</span>}
              </div>
              {isSidebarOpen && (
                <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.7 }}>
                  {projects.length}
                </span>
              )}
            </button>
            {!isSidebarOpen && <div className="tooltip-content">Recent projects ({projects.length})</div>}
          </div>

          {/* 3. Completed Dubs */}
          <div className={!isSidebarOpen ? 'tooltip-trigger' : undefined}>
            <button
              type="button"
              onClick={() => onTabChange('completed')}
              title={!isSidebarOpen ? `Completed dubs (${completedCount})` : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isSidebarOpen ? 'space-between' : 'center',
                padding: isSidebarOpen ? '8px 12px' : '8px 0',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'completed' ? 'rgba(0, 0, 0, 0.07)' : 'transparent',
                color: activeTab === 'completed' ? '#000000' : 'rgba(0, 0, 0, 0.7)',
                fontSize: '13.5px',
                fontWeight: activeTab === 'completed' ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  justifyContent: isSidebarOpen ? 'flex-start' : 'center',
                }}
              >
                <CheckCircle2
                  size={17}
                  strokeWidth={activeTab === 'completed' ? 2 : 1.75}
                  color={activeTab === 'completed' ? '#000000' : 'rgba(0, 0, 0, 0.6)'}
                />
                {isSidebarOpen && <span>Completed dubs</span>}
              </div>
              {isSidebarOpen && (
                <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.7 }}>
                  {completedCount}
                </span>
              )}
            </button>
            {!isSidebarOpen && <div className="tooltip-content">Completed dubs ({completedCount})</div>}
          </div>

          {/* 4. Drafts */}
          <div className={!isSidebarOpen ? 'tooltip-trigger' : undefined}>
            <button
              type="button"
              onClick={() => onTabChange('draft')}
              title={!isSidebarOpen ? `Drafts (${draftCount})` : undefined}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isSidebarOpen ? 'space-between' : 'center',
                padding: isSidebarOpen ? '8px 12px' : '8px 0',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'draft' ? 'rgba(0, 0, 0, 0.07)' : 'transparent',
                color: activeTab === 'draft' ? '#000000' : 'rgba(0, 0, 0, 0.7)',
                fontSize: '13.5px',
                fontWeight: activeTab === 'draft' ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  justifyContent: isSidebarOpen ? 'flex-start' : 'center',
                }}
              >
                <FileEdit
                  size={17}
                  strokeWidth={activeTab === 'draft' ? 2 : 1.75}
                  color={activeTab === 'draft' ? '#000000' : 'rgba(0, 0, 0, 0.6)'}
                />
                {isSidebarOpen && <span>Drafts</span>}
              </div>
              {isSidebarOpen && (
                <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.7 }}>
                  {draftCount}
                </span>
              )}
            </button>
            {!isSidebarOpen && <div className="tooltip-content">Drafts ({draftCount})</div>}
          </div>
        </div>

        {/* Apps Section */}
        <div style={{ marginBottom: '20px' }}>
          {isSidebarOpen ? (
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'rgba(0, 0, 0, 0.4)',
                marginBottom: '10px',
                paddingLeft: '12px',
              }}
            >
              Apps
            </div>
          ) : (
            <div
              style={{
                height: '1px',
                backgroundColor: 'rgba(0, 0, 0, 0.08)',
                margin: '10px 4px',
              }}
            />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div className={!isSidebarOpen ? 'tooltip-trigger' : undefined}>
              <button
                type="button"
                onClick={() => onTabChange('voices')}
                title={!isSidebarOpen ? 'Voices Studio' : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isSidebarOpen ? 'space-between' : 'center',
                  padding: isSidebarOpen ? '8px 12px' : '8px 0',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === 'voices' ? 'rgba(0, 0, 0, 0.07)' : 'transparent',
                  color: activeTab === 'voices' ? '#000000' : 'rgba(0, 0, 0, 0.75)',
                  fontSize: '13.5px',
                  fontWeight: activeTab === 'voices' ? 600 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 120ms ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    justifyContent: isSidebarOpen ? 'flex-start' : 'center',
                  }}
                >
                  <Volume2
                    size={17}
                    strokeWidth={activeTab === 'voices' ? 2 : 1.75}
                    color={activeTab === 'voices' ? '#000000' : 'rgba(0, 0, 0, 0.6)'}
                  />
                  {isSidebarOpen && <span>Voices Studio</span>}
                </div>
                {isSidebarOpen && <Plus size={14} color="rgba(0, 0, 0, 0.45)" />}
              </button>
              {!isSidebarOpen && <div className="tooltip-content">Voices Studio</div>}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
