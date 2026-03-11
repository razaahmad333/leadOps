import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function SuperAdminRoute({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { user, defaultRoute } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.isSuperAdmin) {
    return <Navigate to={defaultRoute} replace />;
  }

  return <>{children}</>;
}
