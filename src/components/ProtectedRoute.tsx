import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';

interface ProtectedRouteProps {
  children: React.ReactNode;
  isAuthenticated?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, isAuthenticated }) => {
  const location = useLocation();
  const token = api.getToken();

  // If explicit isAuthenticated passed, respect it; otherwise check active session token
  const isAuth = isAuthenticated !== undefined ? isAuthenticated : Boolean(token);

  if (!isAuth) {
    return <Navigate to="/signup" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
