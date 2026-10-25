import React from 'react';
import { Menu } from 'lucide-react';

interface DashboardHeaderProps {
  title: string;
  description?: string;
  onOpenMobileDrawer?: () => void;
  primaryAction?: React.ReactNode;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  title,
  description,
  onOpenMobileDrawer,
  primaryAction,
}) => {
  return (
    <div
      className="dashboard-header"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '28px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0 }}>
        {onOpenMobileDrawer && (
          <button
            type="button"
            onClick={onOpenMobileDrawer}
            className="btn btn-ghost dashboard-mobile-menu-btn"
            aria-label="Open navigation menu"
            aria-haspopup="dialog"
            aria-controls="dashboard-navigation-drawer"
            style={{
              padding: '6px',
              marginTop: '2px',
              color: 'var(--c-black)',
            }}
          >
            <Menu size={20} />
          </button>
        )}
        <div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--c-black)',
              letterSpacing: '-0.02em',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
          {description && (
            <p
              style={{
                fontSize: 'var(--text-body)',
                color: 'var(--black-60)',
                marginTop: '4px',
                marginBottom: 0,
                lineHeight: 1.4,
              }}
            >
              {description}
            </p>
          )}
        </div>
      </div>

      {primaryAction && (
        <div className="dashboard-header-action" style={{ flexShrink: 0 }}>
          {primaryAction}
        </div>
      )}
    </div>
  );
};
