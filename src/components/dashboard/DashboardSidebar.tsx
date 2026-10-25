import React, { useEffect, useRef } from 'react';
import type { Project } from '../../types';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import {
  Home,
  Clock,
  Volume2,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  CreditCard,
  Gift,
  X,
} from 'lucide-react';

export type DashboardTab = 'home' | 'recent' | 'completed' | 'draft' | 'voices' | 'gifts' | 'pricing';

interface DashboardSidebarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  projects: Project[];
  isMobileDrawerOpen?: boolean;
  onCloseMobileDrawer?: () => void;
  mobileDrawerTriggerRef?: React.RefObject<HTMLElement | null>;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeTab,
  onTabChange,
  isSidebarOpen,
  onToggleSidebar,
  projects,
  isMobileDrawerOpen = false,
  onCloseMobileDrawer,
  mobileDrawerTriggerRef,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  useDialogFocus({
    isOpen: isMobileDrawerOpen,
    dialogRef: drawerRef,
    returnFocusRef: mobileDrawerTriggerRef,
    onClose: () => onCloseMobileDrawer?.(),
  });

  // A drawer opened on mobile must not keep the desktop page locked after resize.
  useEffect(() => {
    if (!isMobileDrawerOpen || !window.matchMedia) return;
    const media = window.matchMedia('(min-width: 901px)');
    const closeOnDesktop = () => { if (media.matches) onCloseMobileDrawer?.(); };
    media.addEventListener('change', closeOnDesktop);
    return () => media.removeEventListener('change', closeOnDesktop);
  }, [isMobileDrawerOpen, onCloseMobileDrawer]);

  const handleTabClick = (tab: DashboardTab) => {
    onTabChange(tab);
    if (isMobileDrawerOpen) {
      onCloseMobileDrawer?.();
      mobileDrawerTriggerRef?.current?.focus();
    }
  };

  const renderNavContent = (isExpanded: boolean, isMobile: boolean = false) => (
    <div
      className="dashboard-sidebar-inner"
      style={{
        width: isExpanded ? '232px' : '48px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        overflowY: isExpanded ? 'auto' : 'visible',
        overflowX: 'visible',
        paddingRight: isExpanded ? '2px' : '0px',
      }}
    >
      {/* Top Bar with Workspace & Toggle */}
      <div
        className="dashboard-sidebar-heading"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isExpanded ? 'space-between' : 'center',
          marginBottom: '14px',
          padding: isExpanded ? '0 4px' : '0',
        }}
      >
        {isMobile ? (
          <>
            <span
              style={{
                fontSize: 'var(--text-meta)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'rgba(0, 0, 0, 0.5)',
              }}
            >
              Navigation
            </span>
            <button
              type="button"
              onClick={() => {
                onCloseMobileDrawer?.();
                mobileDrawerTriggerRef?.current?.focus();
              }}
              className="btn btn-ghost btn-sm"
              aria-label="Close navigation drawer"
              style={{ padding: '6px', color: 'rgba(0, 0, 0, 0.6)' }}
            >
              <X size={16} />
            </button>
          </>
        ) : isExpanded ? (
          <>
            <span
              style={{
                fontSize: 'var(--text-meta)',
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
              aria-label="Collapse sidebar"
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
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen size={17} />
          </button>
        )}
      </div>

      {/* Primary Navigation Links */}
      <div className="dashboard-sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '24px' }}>
        {/* 1. Home */}
        <div className={!isExpanded ? 'tooltip-trigger' : undefined}>
          <button
            type="button"
            onClick={() => handleTabClick('home')}
            title={!isExpanded ? 'Home' : undefined}
            aria-label="Home"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: isExpanded ? '8px 12px' : '8px 0',
              justifyContent: isExpanded ? 'flex-start' : 'center',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'home' ? 'rgba(0, 0, 0, 0.07)' : 'transparent',
              color: activeTab === 'home' ? '#000000' : 'rgba(0, 0, 0, 0.7)',
              fontSize: 'var(--text-control)',
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
            {isExpanded && <span>Home</span>}
          </button>
          {!isExpanded && <div className="tooltip-content">Home</div>}
        </div>

        {/* 2. Recent Projects */}
        <div className={!isExpanded ? 'tooltip-trigger' : undefined}>
          <button
            type="button"
            onClick={() => handleTabClick('recent')}
            title={!isExpanded ? `Recent projects (${projects.length})` : undefined}
            aria-label={`Recent projects (${projects.length})`}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isExpanded ? 'space-between' : 'center',
              padding: isExpanded ? '8px 12px' : '8px 0',
              borderRadius: '10px',
              border: 'none',
              background: activeTab === 'recent' ? 'rgba(0, 0, 0, 0.07)' : 'transparent',
              color: activeTab === 'recent' ? '#000000' : 'rgba(0, 0, 0, 0.7)',
              fontSize: 'var(--text-control)',
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
                justifyContent: isExpanded ? 'flex-start' : 'center',
              }}
            >
              <Clock
                size={17}
                strokeWidth={activeTab === 'recent' ? 2 : 1.75}
                color={activeTab === 'recent' ? '#000000' : 'rgba(0, 0, 0, 0.6)'}
              />
              {isExpanded && <span>Recent projects</span>}
            </div>
            {isExpanded && (
              <span style={{ fontSize: 'var(--text-meta)', fontWeight: 600, opacity: 0.7 }}>
                {projects.length}
              </span>
            )}
          </button>
          {!isExpanded && <div className="tooltip-content">Recent projects ({projects.length})</div>}
        </div>

      </div>

      {/* Apps Section */}
      <div className="dashboard-sidebar-section" style={{ marginBottom: '20px' }}>
        {isExpanded ? (
          <div
            className="dashboard-sidebar-label"
            style={{
              fontSize: 'var(--text-meta)',
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

        <div className="dashboard-sidebar-section-list" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div className={!isExpanded ? 'tooltip-trigger' : undefined}>
            <button
              type="button"
              onClick={() => handleTabClick('voices')}
              title={!isExpanded ? 'Voices Studio' : undefined}
              aria-label="Voices Studio"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isExpanded ? 'space-between' : 'center',
                padding: isExpanded ? '8px 12px' : '8px 0',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'voices' ? 'rgba(0, 0, 0, 0.07)' : 'transparent',
                color: activeTab === 'voices' ? '#000000' : 'rgba(0, 0, 0, 0.75)',
                fontSize: 'var(--text-control)',
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
                  justifyContent: isExpanded ? 'flex-start' : 'center',
                }}
              >
                <Volume2
                  size={17}
                  strokeWidth={activeTab === 'voices' ? 2 : 1.75}
                  color={activeTab === 'voices' ? '#000000' : 'rgba(0, 0, 0, 0.6)'}
                />
                {isExpanded && <span>Voices Studio</span>}
              </div>
              {isExpanded && <Plus size={14} color="rgba(0, 0, 0, 0.45)" />}
            </button>
            {!isExpanded && <div className="tooltip-content">Voices Studio</div>}
          </div>
        </div>
      </div>

      {/* Premium Section */}
      <div className="dashboard-sidebar-section" style={{ marginBottom: '20px' }}>
        {isExpanded ? (
          <div
            className="dashboard-sidebar-label"
            style={{
              fontSize: 'var(--text-meta)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'rgba(0, 0, 0, 0.4)',
              marginBottom: '10px',
              paddingLeft: '12px',
            }}
          >
            Premium
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

        <div className="dashboard-sidebar-section-list" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {/* 1. Pricing & Plans Item */}
          <div className={!isExpanded ? 'tooltip-trigger' : undefined}>
            <button
              type="button"
              onClick={() => handleTabClick('pricing')}
              title={!isExpanded ? 'Pricing & Plans' : undefined}
              aria-label="Pricing & Plans"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                justifyContent: isExpanded ? 'flex-start' : 'center',
                padding: isExpanded ? '8px 12px' : '8px 0',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'pricing' ? 'rgba(0, 0, 0, 0.07)' : 'transparent',
                color: activeTab === 'pricing' ? '#000000' : 'rgba(0, 0, 0, 0.8)',
                fontSize: 'var(--text-control)',
                fontWeight: activeTab === 'pricing' ? 600 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 120ms ease',
              }}
            >
              <CreditCard
                size={17}
                strokeWidth={activeTab === 'pricing' ? 2 : 1.75}
                color={activeTab === 'pricing' ? '#000000' : 'rgba(0, 0, 0, 0.65)'}
              />
              {isExpanded && <span>Pricing & Plans</span>}
            </button>
            {!isExpanded && <div className="tooltip-content">Pricing & Plans</div>}
          </div>

          {/* 2. Gifts Item */}
          <div className={!isExpanded ? 'tooltip-trigger' : undefined}>
            <button
              type="button"
              onClick={() => handleTabClick('gifts')}
              title={!isExpanded ? 'Gifts' : undefined}
              aria-label="Gifts"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                justifyContent: isExpanded ? 'flex-start' : 'center',
                padding: isExpanded ? '8px 12px' : '8px 0',
                borderRadius: '10px',
                border: 'none',
                background: activeTab === 'gifts' ? 'rgba(0, 0, 0, 0.07)' : 'transparent',
                color: activeTab === 'gifts' ? '#000000' : 'rgba(0, 0, 0, 0.8)',
                fontSize: 'var(--text-control)',
                fontWeight: activeTab === 'gifts' ? 600 : 500,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 120ms ease',
              }}
            >
              <Gift
                size={17}
                strokeWidth={activeTab === 'gifts' ? 2 : 1.75}
                color={activeTab === 'gifts' ? '#000000' : 'rgba(0, 0, 0, 0.65)'}
              />
              {isExpanded && <span>Gifts</span>}
            </button>
            {!isExpanded && <div className="tooltip-content">Gifts</div>}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Rail Sidebar */}
      <aside
        className="dashboard-sidebar desktop-sidebar"
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
        {renderNavContent(isSidebarOpen, false)}
      </aside>

      {/* Mobile Off-Canvas Drawer Backdrop and Drawer */}
      {isMobileDrawerOpen && (
        <div
          className="dashboard-drawer-backdrop"
          data-dialog-backdrop
          onClick={() => {
            onCloseMobileDrawer?.();
            mobileDrawerTriggerRef?.current?.focus();
          }}
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(2px)',
            zIndex: 300,
            animation: 'fadeIn 180ms ease',
          }}
        />
      )}

      {isMobileDrawerOpen && <div
        ref={drawerRef}
        id="dashboard-navigation-drawer"
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Dashboard navigation drawer"
        className={`dashboard-mobile-drawer ${isMobileDrawerOpen ? 'drawer-open' : ''}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: '280px',
          maxWidth: '85vw',
          backgroundColor: '#FAFAFB',
          borderRight: '1px solid rgba(0, 0, 0, 0.1)',
          boxShadow: '4px 0 24px rgba(0, 0, 0, 0.12)',
          zIndex: 310,
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          transform: isMobileDrawerOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
          pointerEvents: isMobileDrawerOpen ? 'auto' : 'none',
        }}
      >
        {renderNavContent(true, true)}
      </div>}
    </>
  );
};
