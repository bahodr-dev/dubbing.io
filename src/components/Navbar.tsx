import React from 'react';
import type { ActiveTab } from '../types';

interface NavbarProps {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  onOpenAuth: () => void;
  onOpenNewDub: () => void;
  isAuthenticated: boolean;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onNavigate,
  onOpenAuth,
  onOpenNewDub,
  isAuthenticated,
  onLogout,
}) => {
  return (
    <header style={{
      borderBottom: 'var(--border-light)',
      backgroundColor: 'var(--c-white)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div className="container-xl" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '68px',
      }}>
        {/* Brand Logo */}
        <div 
          onClick={() => onNavigate('landing')} 
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            userSelect: 'none',
          }}
        >
          <div style={{
            width: '24px',
            height: '24px',
            backgroundColor: 'var(--black-100)',
            borderRadius: 'var(--radius-xs)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
          }}>
            <div style={{ width: '3px', height: '12px', backgroundColor: 'var(--white-100)', borderRadius: '1px' }}></div>
            <div style={{ width: '3px', height: '16px', backgroundColor: 'var(--white-100)', borderRadius: '1px' }}></div>
            <div style={{ width: '3px', height: '8px', backgroundColor: 'var(--white-100)', borderRadius: '1px' }}></div>
          </div>
          <span style={{
            fontSize: '18px',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: 'var(--black-100)',
          }}>
            dubbing.io
          </span>
        </div>

        {/* Center Nav Links */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '32px',
        }}>
          <button
            onClick={() => onNavigate('landing')}
            className="btn-ghost"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '14px',
              fontWeight: activeTab === 'landing' ? 600 : 500,
              color: activeTab === 'landing' ? 'var(--black-100)' : 'var(--black-60)',
              cursor: 'pointer',
              padding: '6px 0',
              borderBottom: activeTab === 'landing' ? '2px solid var(--black-100)' : '2px solid transparent',
              borderRadius: 0,
            }}
          >
            Product
          </button>
          <button
            onClick={() => {
              onNavigate('landing');
              setTimeout(() => {
                const el = document.getElementById('how-it-works');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 50);
            }}
            className="btn-ghost"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--black-60)',
              cursor: 'pointer',
              padding: '6px 0',
              borderRadius: 0,
            }}
          >
            How it works
          </button>
          <button
            onClick={() => onNavigate('pricing')}
            className="btn-ghost"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '14px',
              fontWeight: activeTab === 'pricing' ? 600 : 500,
              color: activeTab === 'pricing' ? 'var(--black-100)' : 'var(--black-60)',
              cursor: 'pointer',
              padding: '6px 0',
              borderBottom: activeTab === 'pricing' ? '2px solid var(--black-100)' : '2px solid transparent',
              borderRadius: 0,
            }}
          >
            Pricing
          </button>
          {isAuthenticated && (
            <button
              onClick={() => onNavigate('dashboard')}
              className="btn-ghost"
              style={{
                background: 'none',
                border: 'none',
                fontSize: '14px',
                fontWeight: activeTab === 'dashboard' || activeTab === 'studio' ? 600 : 500,
                color: activeTab === 'dashboard' || activeTab === 'studio' ? 'var(--black-100)' : 'var(--black-60)',
                cursor: 'pointer',
                padding: '6px 0',
                borderBottom: activeTab === 'dashboard' || activeTab === 'studio' ? '2px solid var(--black-100)' : '2px solid transparent',
                borderRadius: 0,
              }}
            >
              Dashboard
            </button>
          )}
        </nav>

        {/* Right CTA Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          {isAuthenticated ? (
            <>
              <button
                onClick={onLogout}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--black-60)' }}
              >
                Sign out
              </button>
              <button
                onClick={onOpenNewDub}
                className="btn btn-primary btn-sm"
              >
                Start dubbing →
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onOpenAuth}
                className="btn btn-ghost btn-sm"
                style={{ fontWeight: 500 }}
              >
                Sign in
              </button>
              <button
                onClick={onOpenNewDub}
                className="btn btn-primary btn-sm"
              >
                Start dubbing →
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
