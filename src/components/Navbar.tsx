import React, { useState } from 'react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogoClick = () => {
    onNavigate(isAuthenticated ? 'dashboard' : 'signup');
    setMobileMenuOpen(false);
  };

  return (
    <header className="nav-header">
      <div className="nav-container">
        {/* Brand Logo */}
        <div 
          onClick={handleLogoClick}
          style={{
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            userSelect: 'none',
          }}
        >
          <div style={{
            width: '20px',
            height: '20px',
            backgroundColor: 'var(--black-100)',
            borderRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
          }}>
            <div style={{ width: '2px', height: '9px', backgroundColor: 'var(--white-100)', borderRadius: '0.5px' }}></div>
            <div style={{ width: '2px', height: '14px', backgroundColor: 'var(--white-100)', borderRadius: '0.5px' }}></div>
            <div style={{ width: '2px', height: '6px', backgroundColor: 'var(--white-100)', borderRadius: '0.5px' }}></div>
          </div>
          <span style={{
            fontSize: '15.5px',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: 'var(--black-100)',
          }}>
            dubbing.io
          </span>
        </div>

        {/* Center Nav Links (Desktop) */}
        <nav className="nav-desktop-links" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '28px',
        }}>
          {isAuthenticated ? (
            <>
              <button
                onClick={() => onNavigate('dashboard')}
                className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => onNavigate('studio')}
                className={`nav-link ${activeTab === 'studio' ? 'active' : ''}`}
              >
                Studio
              </button>
              <button
                onClick={() => onNavigate('pricing')}
                className={`nav-link ${activeTab === 'pricing' ? 'active' : ''}`}
              >
                Pricing
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onNavigate('signup')}
                className={`nav-link ${activeTab === 'signup' ? 'active' : ''}`}
              >
                Sign Up
              </button>
              <button
                onClick={() => onNavigate('pricing')}
                className={`nav-link ${activeTab === 'pricing' ? 'active' : ''}`}
              >
                Pricing
              </button>
            </>
          )}
        </nav>

        {/* Right CTA Actions (Desktop) */}
        <div className="nav-desktop-links" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          {isAuthenticated ? (
            <>
              <button
                onClick={onLogout}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--black-60)', fontSize: '13px', fontWeight: 500 }}
              >
                Sign out
              </button>
              <button
                onClick={onOpenNewDub}
                className="btn btn-primary btn-sm btn-arrow-group"
                style={{ padding: '7px 14px', fontSize: '13px', fontWeight: 600 }}
              >
                <span>Start dubbing</span>
                <span className="arrow-symbol">→</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onOpenAuth}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '13px', fontWeight: 500 }}
              >
                Sign in
              </button>
              <button
                onClick={() => onNavigate('signup')}
                className="btn btn-primary btn-sm btn-arrow-group"
                style={{ padding: '7px 14px', fontSize: '13px', fontWeight: 600 }}
              >
                <span>Create account</span>
                <span className="arrow-symbol">→</span>
              </button>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle Button */}
        <button
          className="nav-mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            flexDirection: 'column',
            gap: '4px',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          aria-label="Toggle navigation menu"
        >
          <div style={{
            width: '18px',
            height: '1.5px',
            backgroundColor: 'var(--black-100)',
            transition: 'transform 180ms ease',
            transform: mobileMenuOpen ? 'translateY(5.5px) rotate(45deg)' : 'none',
          }}></div>
          <div style={{
            width: '18px',
            height: '1.5px',
            backgroundColor: 'var(--black-100)',
            transition: 'opacity 180ms ease',
            opacity: mobileMenuOpen ? 0 : 1,
          }}></div>
          <div style={{
            width: '18px',
            height: '1.5px',
            backgroundColor: 'var(--black-100)',
            transition: 'transform 180ms ease',
            transform: mobileMenuOpen ? 'translateY(-5.5px) rotate(-45deg)' : 'none',
          }}></div>
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="nav-mobile-drawer" style={{
          borderTop: 'var(--border-subtle)',
          backgroundColor: 'var(--c-white)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          {isAuthenticated ? (
            <>
              <button
                onClick={() => {
                  onNavigate('dashboard');
                  setMobileMenuOpen(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '15px',
                  fontWeight: activeTab === 'dashboard' ? 700 : 500,
                  color: 'var(--black-100)',
                  cursor: 'pointer',
                  padding: '6px 0',
                }}
              >
                Dashboard
              </button>
              <button
                onClick={() => {
                  onNavigate('studio');
                  setMobileMenuOpen(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '15px',
                  fontWeight: activeTab === 'studio' ? 700 : 500,
                  color: 'var(--black-100)',
                  cursor: 'pointer',
                  padding: '6px 0',
                }}
              >
                Studio
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                onNavigate('signup');
                setMobileMenuOpen(false);
              }}
              style={{
                background: 'none',
                border: 'none',
                textAlign: 'left',
                fontSize: '15px',
                fontWeight: activeTab === 'signup' ? 700 : 500,
                color: 'var(--black-100)',
                cursor: 'pointer',
                padding: '6px 0',
              }}
            >
              Sign Up
            </button>
          )}
          <button
            onClick={() => {
              onNavigate('pricing');
              setMobileMenuOpen(false);
            }}
            style={{
              background: 'none',
              border: 'none',
              textAlign: 'left',
              fontSize: '15px',
              fontWeight: activeTab === 'pricing' ? 700 : 500,
              color: 'var(--black-100)',
              cursor: 'pointer',
              padding: '6px 0',
            }}
          >
            Pricing
          </button>

          <div style={{
            borderTop: 'var(--border-subtle)',
            paddingTop: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}>
            {isAuthenticated ? (
              <>
                <button
                  onClick={() => {
                    onLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="btn btn-secondary"
                  style={{ width: '100%', fontSize: '14px' }}
                >
                  Sign out
                </button>
                <button
                  onClick={() => {
                    onOpenNewDub();
                    setMobileMenuOpen(false);
                  }}
                  className="btn btn-primary btn-arrow-group"
                  style={{ width: '100%', fontSize: '14px', fontWeight: 600 }}
                >
                  <span>Start dubbing</span>
                  <span className="arrow-symbol">→</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    onOpenAuth();
                    setMobileMenuOpen(false);
                  }}
                  className="btn btn-secondary"
                  style={{ width: '100%', fontSize: '14px' }}
                >
                  Sign in
                </button>
                <button
                  onClick={() => {
                    onNavigate('signup');
                    setMobileMenuOpen(false);
                  }}
                  className="btn btn-primary btn-arrow-group"
                  style={{ width: '100%', fontSize: '14px', fontWeight: 600 }}
                >
                  <span>Create account</span>
                  <span className="arrow-symbol">→</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
