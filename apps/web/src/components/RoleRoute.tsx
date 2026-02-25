import React, { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

interface RoleRouteProps {
  role: 'OWNER' | 'STAFF';
  children: ReactNode;
}

export function RoleRoute({ role, children }: RoleRouteProps): React.JSX.Element {
  const { user } = useAuth();
  if (!user || user.role !== role) {
    return <Navigate to={user?.role === 'STAFF' ? '/staff/today' : '/login'} replace />;
  }
  return <>{children}</>;
}
