import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  BellRing,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ListChecks,
  Mail,
  Menu,
  Phone,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { cn } from '../../lib/utils';
import { Skeleton } from '../ui/skeleton';

interface NavItem {
  to: string;
  label: string;
  mobileLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: string;
}

export function AppShell(): React.JSX.Element {
  const { user, logout, can, defaultRoute } = useAuth();
  const { dictionary, loading, profile } = useTenant();
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  const navItems = useMemo<NavItem[]>(
    () => [
      {
        to: '/owner/dashboard',
        label: dictionary.labels.dashboardTitle,
        mobileLabel: 'Dashboard',
        icon: BarChart3,
        permission: 'dashboard.view',
      },
      {
        to: '/staff/today',
        label: dictionary.labels.todayFollowupsTitle,
        mobileLabel: 'Follow-ups',
        icon: ListChecks,
        permission: 'followups.view',
      },
      {
        to: '/leads',
        label: dictionary.labels.leadPlural,
        mobileLabel: dictionary.labels.leadPlural,
        icon: Briefcase,
        permission: 'enquiries.view',
      },
      {
        to: '/settings/team',
        label: 'Team',
        mobileLabel: 'Team',
        icon: Users,
        permission: 'users.manage',
      },
      {
        to: '/settings/roles',
        label: 'Roles',
        mobileLabel: 'Roles',
        icon: ShieldCheck,
        permission: 'roles.manage',
      },
      {
        to: '/settings/permissions',
        label: 'Permissions',
        mobileLabel: 'Permissions',
        icon: ShieldCheck,
        permission: 'permissions.view',
      },
      {
        to: '/settings',
        label: 'Settings',
        mobileLabel: 'Settings',
        icon: Settings,
        permission: 'settings.view',
      },
    ],
    [dictionary.labels.dashboardTitle, dictionary.labels.leadPlural, dictionary.labels.todayFollowupsTitle],
  );

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => user && can(item.permission)),
    [can, navItems, user],
  );
  const mobilePrimaryNav = useMemo(() => visibleNavItems.slice(0, 4), [visibleNavItems]);

  const handleLogout = (): void => {
    logout();
    void navigate('/login', { replace: true });
  };

  const handleHome = (): void => {
    void navigate(defaultRoute, { replace: true });
  };

  const accentStyle = dictionary.theme?.accentColor
    ? ({ '--tenant-accent': dictionary.theme.accentColor } as React.CSSProperties)
    : undefined;
  const supportPhone = ((import.meta.env.VITE_SUPPORT_PHONE as string | undefined) ?? '+1 555 010 1000').trim();
  const supportEmail = ((import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ?? 'support@hikmahone.com').trim();
  const supportPhoneHref = `tel:${supportPhone.replace(/[^\d+]/g, '')}`;

  if (loading && !profile) {
    return (
      <div className="flex min-h-screen bg-slate-950/[0.02]" style={accentStyle}>
        <aside className="hidden w-[290px] border-r border-white/70 bg-card/80 p-5 backdrop-blur md:block">
          <Skeleton className="mb-6 h-10 w-full" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </aside>
        <div className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <Skeleton className="h-24 w-full rounded-[2rem]" />
          <div className="mt-5 space-y-4">
            <Skeleton className="h-44 w-full rounded-3xl" />
            <Skeleton className="h-44 w-full rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  const SideContent = (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/70 px-4 pb-4 pt-5">
        <div className={cn('flex gap-3', sidebarCollapsed ? 'justify-center' : 'items-start justify-between')}>
          <div className={cn('transition-all', sidebarCollapsed ? 'hidden' : 'block')}>
            <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">HikmahOne</p>
            <p className="mt-2 text-lg font-semibold">{dictionary.theme?.sidebarTitle ?? 'LeadOps'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {dictionary.labels.sidebarSubtitle || 'Tenant-aware workspace'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(false)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {!sidebarCollapsed ? (
          <div className="mt-4 rounded-2xl border border-white/70 bg-background/90 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Workspace</p>
            <p className="mt-2 text-sm font-semibold text-foreground">{dictionary.tenantName}</p>
            {profile ? (
              <Badge variant="outline" className="mt-3 rounded-full">
                {profile.industryPreset === 'DIAGNOSTICS_LAB' ? 'Diagnostics Lab' : 'Generic'}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/settings'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors',
                  sidebarCollapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-[0_14px_30px_-18px_hsl(var(--primary))]'
                    : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={cn(sidebarCollapsed && 'hidden')}>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/70 px-3 py-4">
        <button
          type="button"
          onClick={() => setSupportOpen(true)}
          className={cn(
            'flex w-full items-center justify-between rounded-2xl border border-input bg-background px-3 py-3 text-sm font-medium transition-colors hover:bg-secondary/60',
            sidebarCollapsed && 'justify-center px-0',
          )}
        >
          <span className={cn('flex items-center gap-2', sidebarCollapsed && 'justify-center')}>
            <CircleHelp className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={cn(sidebarCollapsed && 'hidden')}>Help & Support</span>
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="relative flex min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(61,147,171,0.14),transparent_32%),radial-gradient(circle_at_top_right,rgba(104,171,154,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,250,252,0.98))]"
      style={accentStyle}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-[linear-gradient(90deg,rgba(22,78,99,0.12),rgba(15,118,110,0.08),transparent)]" />

      <aside
        className={cn(
          'relative z-10 hidden border-r border-white/70 bg-card/80 backdrop-blur xl:block',
          sidebarCollapsed ? 'w-[92px]' : 'w-[290px]',
        )}
      >
        {SideContent}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-950/35 xl:hidden" onClick={() => setMobileOpen(false)} />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[294px] max-w-[88vw] border-r border-white/80 bg-card/95 backdrop-blur transition-transform xl:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {SideContent}
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 px-3 pt-2 sm:px-4 sm:pt-3 lg:px-6 xl:px-8">
          <div className="overflow-hidden rounded-b-[2rem] border-x border-b border-white/80 bg-background/90 px-4 py-4 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.45)] backdrop-blur sm:rounded-[1.75rem] sm:border sm:px-5 xl:rounded-[2rem] xl:border-0 xl:bg-[linear-gradient(180deg,rgba(255,255,255,0.52),rgba(239,248,248,0.68))] xl:px-6 xl:py-4 xl:shadow-[0_18px_40px_-34px_rgba(15,23,42,0.28)] xl:backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 xl:hidden">
              <div className="flex min-w-0 items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 rounded-2xl"
                  onClick={() => setMobileOpen((prev) => !prev)}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <div>
                  <p className="text-lg font-semibold leading-none sm:text-xl">Welcome</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Button variant="secondary" size="icon" className="rounded-2xl">
                  <BellRing className="h-4 w-4" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-10 max-w-[8.5rem] rounded-2xl px-3 text-left sm:max-w-none"
                    >
                      <span className="truncate">{user?.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="hidden xl:block">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Tenant</p>
                    <button
                      type="button"
                      className="mt-1 truncate text-left text-lg font-semibold leading-none sm:text-xl"
                      onClick={handleHome}
                    >
                      {dictionary.tenantName}
                    </button>
                    {dictionary.labels.sidebarSubtitle ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{dictionary.labels.sidebarSubtitle}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button variant="secondary" size="icon" className="rounded-2xl">
                    <BellRing className="h-4 w-4" />
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-10 max-w-[8.5rem] rounded-2xl px-3 text-left sm:max-w-none"
                      >
                        <span className="truncate">{user?.name}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {profile ? (
                  <Badge variant="outline" className="rounded-full border-white/70 bg-background/90 px-3 py-1">
                    {profile.industryPreset === 'DIAGNOSTICS_LAB' ? 'Diagnostics Lab' : 'Generic'}
                  </Badge>
                ) : null}
                {dictionary.featureFlags.aiAssist ? (
                  <Badge variant="default" className="gap-1 rounded-full px-3 py-1">
                    <Sparkles className="h-3 w-3" />
                    AI Assist
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-3 pb-24 pt-5 sm:px-6 sm:pb-28 lg:px-8 lg:pb-8">
          <Outlet />
        </main>

        {mobilePrimaryNav.length > 0 ? (
          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/80 bg-background/92 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur xl:hidden">
            <div className="grid grid-cols-4 gap-1 rounded-[1.4rem] border border-white/70 bg-background/95 p-1 shadow-[0_-14px_30px_-24px_rgba(15,23,42,0.35)]">
              {mobilePrimaryNav.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'grid min-w-0 min-h-[4.4rem] place-items-center gap-1 rounded-[1.1rem] px-1 py-2 text-center text-[10px] font-semibold leading-none transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-[0_14px_26px_-18px_hsl(var(--primary))]'
                          : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="block w-full truncate text-center leading-[1.1]">{item.mobileLabel}</span>
                  </NavLink>
                );
              })}
            </div>
          </nav>
        ) : null}
      </div>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Help & Support</DialogTitle>
            <DialogDescription>
              Reach out if you need help with login, tenant access, or day-to-day platform issues.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <a
              href={supportPhoneHref}
              className="flex items-center gap-3 rounded-2xl border border-white/70 bg-secondary/30 px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary/50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-background">
                <Phone className="h-4 w-4 text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs uppercase tracking-[0.16em] text-muted-foreground">Phone</span>
                <span className="block truncate">{supportPhone}</span>
              </span>
            </a>

            <a
              href={`mailto:${supportEmail}`}
              className="flex items-center gap-3 rounded-2xl border border-white/70 bg-secondary/30 px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary/50"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-background">
                <Mail className="h-4 w-4 text-primary" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs uppercase tracking-[0.16em] text-muted-foreground">Email</span>
                <span className="block truncate">{supportEmail}</span>
              </span>
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
