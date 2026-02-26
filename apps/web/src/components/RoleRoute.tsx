import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RoleRoute({
  role,
  children,
}: {
  role: 'OWNER' | 'STAFF';
  children: React.ReactNode;
}): React.JSX.Element {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={user.role === 'OWNER' ? '/owner/dashboard' : '/staff/today'} replace />;
  }

  return <>{children}</>;
}
