import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function PermissionRoute({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { user, can, defaultRoute } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!can(permission)) {
    return <Navigate to={defaultRoute} replace />;
  }

  return <>{children}</>;
}
