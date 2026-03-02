import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { TenantProfile } from '@leadops/shared';
import { api } from '../lib/api';
import { buildUiDictionary, createFallbackTenantProfile, type UiDictionary } from '../lib/ui-dictionary';
import { useAuth } from './AuthContext';

const TENANT_CACHE_KEY = 'tenant_profile_v1';
const TENANT_CACHE_SCHEMA_VERSION = 1;

interface CachedTenantProfile {
  schemaVersion: number;
  savedAt: number;
  tenantId: string;
  configVersion: number;
  profile: TenantProfile;
}

interface TenantContextValue {
  profile: TenantProfile | null;
  dictionary: UiDictionary;
  loading: boolean;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function readCachedTenantProfile(): TenantProfile | null {
  const raw = localStorage.getItem(TENANT_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CachedTenantProfile | TenantProfile;

    if ('profile' in parsed && 'schemaVersion' in parsed) {
      if (parsed.schemaVersion !== TENANT_CACHE_SCHEMA_VERSION) {
        return null;
      }
      return parsed.profile;
    }

    return parsed as TenantProfile;
  } catch {
    return null;
  }
}

function writeCachedTenantProfile(profile: TenantProfile): void {
  const payload: CachedTenantProfile = {
    schemaVersion: TENANT_CACHE_SCHEMA_VERSION,
    savedAt: Date.now(),
    tenantId: profile.tenantId,
    configVersion: profile.configVersion,
    profile,
  };

  localStorage.setItem(TENANT_CACHE_KEY, JSON.stringify(payload));
}

function parseHexColor(hex: string): { h: number; s: number; l: number } | null {
  const sanitized = hex.replace('#', '').trim();
  if (!/^[a-fA-F0-9]{6}$/.test(sanitized)) {
    return null;
  }

  const r = parseInt(sanitized.slice(0, 2), 16) / 255;
  const g = parseInt(sanitized.slice(2, 4), 16) / 255;
  const b = parseInt(sanitized.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }

  h = Math.round(h * 60);
  if (h < 0) h += 360;

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

function toHslChannels(color: string): string | null {
  const trimmed = color.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('#')) {
    const parsed = parseHexColor(trimmed);
    if (!parsed) return null;
    return `${parsed.h} ${parsed.s}% ${parsed.l}%`;
  }

  if (/^\d+\s+\d+%\s+\d+%$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function TenantProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { user, tenantName, isAuthenticated } = useAuth();
  const [profile, setProfile] = useState<TenantProfile | null>(readCachedTenantProfile);
  const [loading, setLoading] = useState(false);

  const refreshTenant = useCallback(async (): Promise<void> => {
    if (!isAuthenticated || !user) {
      setProfile(null);
      return;
    }

    setLoading(true);

    const cached = readCachedTenantProfile();
    if (cached && cached.tenantId === user.tenantId) {
      setProfile(cached);
    }

    try {
      const response = await api.get<TenantProfile>('/v1/tenant/me');
      setProfile(response);
      writeCachedTenantProfile(response);
    } catch {
      const fallback = createFallbackTenantProfile(tenantName);
      setProfile(fallback);
      writeCachedTenantProfile(fallback);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, tenantName, user]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setProfile(null);
      localStorage.removeItem(TENANT_CACHE_KEY);
      return;
    }

    void refreshTenant();
  }, [isAuthenticated, refreshTenant, user]);

  const dictionary = useMemo(() => buildUiDictionary(profile), [profile]);

  useEffect(() => {
    const accent = dictionary.theme?.accentColor;
    const root = document.documentElement;
    if (!accent) {
      root.style.removeProperty('--tenant-accent');
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-foreground');
      return;
    }

    root.style.setProperty('--tenant-accent', accent);
    const hslChannels = toHslChannels(accent);
    if (!hslChannels) {
      return;
    }

    root.style.setProperty('--primary', hslChannels);
    root.style.setProperty('--ring', hslChannels);

    const parsed = parseHexColor(accent);
    if (parsed) {
      const accentSoft = `${parsed.h} ${Math.max(parsed.s - 36, 8)}% ${Math.min(parsed.l + 34, 94)}%`;
      const accentForeground = `${parsed.h} ${Math.min(parsed.s + 12, 72)}% ${Math.max(parsed.l - 28, 20)}%`;
      root.style.setProperty('--accent', accentSoft);
      root.style.setProperty('--accent-foreground', accentForeground);
    }
  }, [dictionary.theme?.accentColor]);

  return (
    <TenantContext.Provider value={{ profile, dictionary, loading, refreshTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const context = useContext(TenantContext);

  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }

  return context;
}
