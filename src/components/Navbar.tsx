import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, CreditCard, LayoutDashboard, Film, LogOut, Sparkles } from 'lucide-react';
import type { ActiveTab } from '../types';
import { Logo } from './Logo';

interface NavbarProps {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
  onOpenAuth: () => void;
  onOpenNewDub: () => void;
  isAuthenticated: boolean;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onNavigate,
  onOpenAuth,
  isAuthenticated,
  onLogout,
}) => {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLogoClick = () => {
    onNavigate(isAuthenticated ? 'dashboard' : 'signup');
    setIsAccountMenuOpen(false);
  };

  return (
    <header className="nav-header">
      <div className="nav-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        {/* Brand Logo (Always on the Left) */}
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
          <Logo size={22} />
          <span style={{
            fontSize: '15.5px',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: 'var(--black-100)',
          }}>
            dubbing.io
          </span>
        </div>

        {/* Right Action: User Account Dropdown */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          position: 'relative',
        }}>
          {isAuthenticated ? (
            /* User Account Popover Trigger */
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 14px 5px 6px',
                  backgroundColor: isAccountMenuOpen ? 'var(--black-05)' : 'var(--c-white)',
                  border: 'var(--border-light)',
                  borderRadius: 'var(--radius-pill)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  outline: 'none',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--black-40)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--black-12)';
                }}
              >
                {/* User Avatar */}
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
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

                <span style={{
                  fontSize: '13.5px',
                  fontWeight: 600,
                  color: 'var(--black-100)',
                }}>
                  Account
                </span>

                <ChevronDown 
                  size={14} 
                  color="var(--black-60)" 
                  style={{
                    transition: 'transform 180ms ease',
                    transform: isAccountMenuOpen ? 'rotate(180deg)' : 'none',
                  }} 
                />
              </button>

              {/* Dropdown Menu Popover */}
              {isAccountMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: '240px',
                  backgroundColor: 'var(--c-white)',
                  border: 'var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.12)',
                  padding: '8px',
                  zIndex: 1000,
                  animation: 'modalSlideUp 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                }}>
                  {/* User Profile Info Header */}
                  <div style={{
                    padding: '10px 12px',
                    borderBottom: 'var(--border-light)',
                    marginBottom: '6px',
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--black-100)' }}>
                      Bahodir S.
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--black-60)', marginTop: '1px' }}>
                      bahodir@dubbing.io
                    </div>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      marginTop: '6px',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'var(--black-05)',
                      border: 'var(--border-subtle)',
                      fontSize: '10.5px',
                      fontWeight: 600,
                      color: 'var(--black-80)',
                    }}>
                      <Sparkles size={10} />
                      Creator Plan • 42/60m
                    </div>
                  </div>

                  {/* Navigation Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigate('pricing');
                        setIsAccountMenuOpen(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: activeTab === 'pricing' ? 'var(--black-05)' : 'transparent',
                        color: 'var(--black-100)',
                        fontSize: '13px',
                        fontWeight: activeTab === 'pricing' ? 600 : 500,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background-color var(--transition-fast)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--black-05)'}
                      onMouseLeave={e => {
                        if (activeTab !== 'pricing') e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <CreditCard size={15} color="var(--black-60)" />
                      <span>Pricing & Plans</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onNavigate('dashboard');
                        setIsAccountMenuOpen(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: activeTab === 'dashboard' ? 'var(--black-05)' : 'transparent',
                        color: 'var(--black-100)',
                        fontSize: '13px',
                        fontWeight: activeTab === 'dashboard' ? 600 : 500,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background-color var(--transition-fast)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--black-05)'}
                      onMouseLeave={e => {
                        if (activeTab !== 'dashboard') e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <LayoutDashboard size={15} color="var(--black-60)" />
                      <span>Dashboard</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onNavigate('studio');
                        setIsAccountMenuOpen(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: activeTab === 'studio' ? 'var(--black-05)' : 'transparent',
                        color: 'var(--black-100)',
                        fontSize: '13px',
                        fontWeight: activeTab === 'studio' ? 600 : 500,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background-color var(--transition-fast)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--black-05)'}
                      onMouseLeave={e => {
                        if (activeTab !== 'studio') e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <Film size={15} color="var(--black-60)" />
                      <span>Studio Editor</span>
                    </button>
                  </div>

                  {/* Divider & Sign out */}
                  <div style={{
                    borderTop: 'var(--border-light)',
                    marginTop: '6px',
                    paddingTop: '6px',
                  }}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        onLogout?.();
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'transparent',
                        color: 'var(--black-80)',
                        fontSize: '13px',
                        fontWeight: 500,
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'background-color var(--transition-fast)',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = 'var(--black-05)';
                        e.currentTarget.style.color = 'var(--black-100)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--black-80)';
                      }}
                    >
                      <LogOut size={15} color="var(--black-60)" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
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
                style={{ padding: '7px 16px', fontSize: '13px', fontWeight: 600 }}
              >
                <span>Create account</span>
                <span className="arrow-symbol">→</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
