import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BellRing,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  Menu,
  Settings,
  Sparkles,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';

interface TenantSettingsResponse {
  featureFlags?: Record<string, boolean>;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<'OWNER' | 'STAFF'>;
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/owner/dashboard',
    label: 'Dashboard',
    icon: BarChart3,
    roles: ['OWNER'],
  },
  {
    to: '/staff/today',
    label: "Today's Follow-ups",
    icon: ListChecks,
    roles: ['OWNER', 'STAFF'],
  },
  {
    to: '/leads',
    label: 'Leads',
    icon: Briefcase,
    roles: ['OWNER', 'STAFF'],
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: Settings,
    roles: ['OWNER', 'STAFF'],
  },
];

export function AppShell(): React.JSX.Element {
  const { user, tenantName, logout } = useAuth();
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showAiBadge, setShowAiBadge] = useState(false);

  useEffect(() => {
    api
      .get<TenantSettingsResponse>('/v1/settings')
      .then((settings) => {
        setShowAiBadge(Boolean(settings.featureFlags?.aiAssist));
      })
      .catch(() => {
        setShowAiBadge(false);
      });
  }, []);

  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => user && item.roles.includes(user.role as 'OWNER' | 'STAFF')),
    [user],
  );

  const handleLogout = (): void => {
    logout();
    void navigate('/login', { replace: true });
  };

  const SideContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between border-b px-4">
        <div className={cn('transition-all', sidebarCollapsed ? 'hidden' : 'block')}>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">HikmahOne</p>
          <p className="text-lg font-semibold">LeadOps</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarCollapsed((prev) => !prev)}>
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
      <nav className="space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span className={cn(sidebarCollapsed && 'hidden')}>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          'hidden border-r bg-card/90 backdrop-blur md:block',
          sidebarCollapsed ? 'w-[86px]' : 'w-[270px]',
        )}
      >
        {SideContent}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-black/35 md:hidden" onClick={() => setMobileOpen(false)} />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[270px] border-r bg-card transition-transform md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {SideContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen((prev) => !prev)}>
                <Menu className="h-4 w-4" />
              </Button>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tenant</p>
                <p className="font-semibold">{tenantName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {showAiBadge ? (
                <Badge variant="default" className="gap-1 rounded-full">
                  <Sparkles className="h-3 w-3" />
                  AI Assist
                </Badge>
              ) : null}

              <Button variant="secondary" size="icon">
                <BellRing className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 px-3">
                    {user?.name}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
