import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  isAuthenticated?: boolean;
  isLoading?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  isAuthenticated = false,
  isLoading = false,
}) => {
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="route-loading" role="status" aria-live="polite">
        <div className="route-loading-card">
          <div className="route-loading-spinner" aria-hidden="true" />
          <span>Loading your workspace...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/signup" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
