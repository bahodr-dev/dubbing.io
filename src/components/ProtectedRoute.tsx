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
  const savedUser = localStorage.getItem('dubbing_io_user');

  const isAuth = isAuthenticated !== undefined ? isAuthenticated : Boolean(token || savedUser);

  if (!isAuth) {
    return <Navigate to="/signup" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
