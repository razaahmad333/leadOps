import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  AuthUser,
  AuthFlowResponse,
  LoginResponse,
  RequestLoginOtpResponse,
  TenantSelectionChallenge,
} from '@leadops/shared';
import { api } from '../lib/api';

interface SessionState {
  user: AuthUser;
  tenantName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  tenantName: string;
  isAuthenticated: boolean;
  pendingTenantSelection: TenantSelectionChallenge | null;
  can: (permission: string) => boolean;
  defaultRoute: string;
  login: (identifier: string, password: string) => Promise<TenantSelectionChallenge | null>;
  requestLoginOtp: (phone: string) => Promise<RequestLoginOtpResponse>;
  loginWithOtp: (phone: string, verificationId: string, otpCode: string) => Promise<TenantSelectionChallenge | null>;
  clearPendingTenantSelection: () => void;
  selectTenant: (selectionToken: string, tenantId: string) => Promise<LoginResponse>;
  switchTenant: (tenantId: string) => Promise<LoginResponse>;
  refreshUser: () => Promise<void>;
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
  const [pendingTenantSelection, setPendingTenantSelection] = useState<TenantSelectionChallenge | null>(null);

  const persistSession = useCallback((next: SessionState | null): void => {
    if (!next) {
      localStorage.removeItem('session');
      setSession(null);
      return;
    }

    localStorage.setItem('session', JSON.stringify(next));
    setSession(next);
  }, []);

  const applyLoginResponse = useCallback((response: LoginResponse): void => {
    localStorage.setItem('access_token', response.accessToken);
    setPendingTenantSelection(null);
    persistSession({
      tenantName: response.tenantName,
      user: response.user,
    });
  }, [persistSession]);

  const applyAuthFlowResponse = useCallback((response: AuthFlowResponse): TenantSelectionChallenge | null => {
    if (response.kind === 'authenticated') {
      applyLoginResponse(response);
      return null;
    }

    localStorage.removeItem('access_token');
    persistSession(null);
    setPendingTenantSelection(response);
    return response;
  }, [applyLoginResponse, persistSession]);

  const login = useCallback(async (identifier: string, password: string): Promise<TenantSelectionChallenge | null> => {
    const response = await api.post<AuthFlowResponse>(
      '/v1/auth/login',
      { identifier, password },
      { skipAuth: true },
    );

    return applyAuthFlowResponse(response);
  }, [applyAuthFlowResponse]);

  const requestLoginOtp = useCallback(async (phone: string): Promise<RequestLoginOtpResponse> => {
    return api.post<RequestLoginOtpResponse>(
      '/v1/auth/forgot-password/request-otp',
      { phone },
      { skipAuth: true },
    );
  }, []);

  const loginWithOtp = useCallback(async (
    phone: string,
    verificationId: string,
    otpCode: string,
  ): Promise<TenantSelectionChallenge | null> => {
    const response = await api.post<AuthFlowResponse>(
      '/v1/auth/forgot-password/verify-otp',
      { phone, verificationId, otpCode },
      { skipAuth: true },
    );

    return applyAuthFlowResponse(response);
  }, [applyAuthFlowResponse]);

  const selectTenant = useCallback(async (selectionToken: string, tenantId: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>(
      '/v1/auth/select-tenant',
      { selectionToken, tenantId },
      { skipAuth: true },
    );

    applyLoginResponse(response);
    return response;
  }, [applyLoginResponse]);

  const switchTenant = useCallback(async (tenantId: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>(
      '/v1/auth/switch-tenant',
      { tenantId },
    );

    applyLoginResponse(response);
    return response;
  }, [applyLoginResponse]);

  const refreshUser = useCallback(async (): Promise<void> => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      persistSession(null);
      return;
    }

    try {
      const user = await api.get<AuthUser>('/v1/auth/me');
      const currentSession = readSession();
      persistSession({
        tenantName: currentSession?.tenantName ?? 'Tenant',
        user,
      });
    } catch {
      localStorage.removeItem('access_token');
      persistSession(null);
    }
  }, [persistSession]);

  const logout = useCallback((): void => {
    localStorage.removeItem('access_token');
    setPendingTenantSelection(null);
    persistSession(null);
  }, [persistSession]);

  const clearPendingTenantSelection = useCallback((): void => {
    setPendingTenantSelection(null);
  }, []);

  const can = useCallback(
    (permission: string): boolean => {
      const permissions = session?.user?.effectivePermissions ?? [];
      return permissions.includes(permission);
    },
    [session?.user?.effectivePermissions],
  );

  const defaultRoute = useMemo(() => {
    if (!session?.user) {
      return '/login';
    }

    if (session.user.effectivePermissions.includes('dashboard.view')) {
      return '/owner/dashboard';
    }

    if (session.user.effectivePermissions.includes('followups.view')) {
      return '/staff/today';
    }

    if (session.user.effectivePermissions.includes('enquiries.view')) {
      return '/leads';
    }

    if (session.user.effectivePermissions.includes('settings.view')) {
      return '/settings';
    }

    return '/login';
  }, [session?.user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      tenantName: session?.tenantName ?? 'Tenant',
      isAuthenticated: !!session?.user,
      pendingTenantSelection,
      can,
      defaultRoute,
      login,
      requestLoginOtp,
      loginWithOtp,
      clearPendingTenantSelection,
      selectTenant,
      switchTenant,
      refreshUser,
      logout,
    }),
    [
      can,
      defaultRoute,
      login,
      loginWithOtp,
      logout,
      pendingTenantSelection,
      refreshUser,
      requestLoginOtp,
      clearPendingTenantSelection,
      selectTenant,
      session,
      switchTenant,
    ],
  );

  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      persistSession(null);
      return;
    }

    void refreshUser();
  }, [persistSession, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
