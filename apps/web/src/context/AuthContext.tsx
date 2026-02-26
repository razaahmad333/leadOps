import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser, LoginResponse } from '@leadops/shared';
import { api } from '../lib/api';

interface SessionState {
  user: AuthUser;
  tenantName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  tenantName: string;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): SessionState | null {
  const raw = localStorage.getItem('session');
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [session, setSession] = useState<SessionState | null>(readSession);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const response = await api.post<LoginResponse>(
      '/v1/auth/login',
      { email, password },
      { skipAuth: true },
    );

    localStorage.setItem('access_token', response.accessToken);

    const next = {
      user: response.user,
      tenantName: response.tenantName,
    };

    localStorage.setItem('session', JSON.stringify(next));
    setSession(next);
  }, []);

  const logout = useCallback((): void => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('session');
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      tenantName: session?.tenantName ?? 'Tenant',
      isAuthenticated: !!session?.user,
      login,
      logout,
    }),
    [login, logout, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
