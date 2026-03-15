import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  ListChecks,
  MessageSquareQuote,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type {
  Notification as AppNotification,
  NotificationListResponse,
  NotificationMutationResult,
  UnreadNotificationCount,
} from '@leadops/shared';
import { useAuth } from '../../context/AuthContext';
import { useProductTour } from '../../context/ProductTourContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../lib/api';
import { buildBranchOptions, resolveBranchScopeLabel } from '../../lib/branch-scope';
import { cn } from '../../lib/utils';
import { Skeleton } from '../ui/skeleton';
import { ShellBottomNav } from './app-shell/ShellBottomNav';
import { ShellHeader } from './app-shell/ShellHeader';
import { ShellSidebar } from './app-shell/ShellSidebar';
import { SupportDialog } from './app-shell/SupportDialog';
import { UserManualDialog } from './app-shell/UserManualDialog';
import { MANUAL_DESCRIPTION_BY_ROUTE } from './app-shell/app-shell.constants';
import type { ManualModule, NavItem } from './app-shell/app-shell.types';
import { navTourId, resolveDefaultRouteForPermissions, resolveSupportContacts } from './app-shell/app-shell.utils';

export function AppShell(): React.JSX.Element {
  const { user, logout, switchTenant, can, defaultRoute, selectedBranchId, setSelectedBranchId } = useAuth();
  const { subscribeNotification } = useRealtime();
  const { startTour } = useProductTour();
  const { dictionary, loading, profile } = useTenant();
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

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
        to: '/support/questions',
        label: 'Q&A Inbox',
        mobileLabel: 'Q&A',
        icon: MessageSquareQuote,
        permission: 'faq.view',
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
      {
        to: '/platform/admin',
        label: 'Platform Admin',
        mobileLabel: 'Admin',
        icon: ShieldCheck,
        permission: 'settings.view',
        superAdminOnly: true,
      },
    ],
    [dictionary.labels.dashboardTitle, dictionary.labels.leadPlural, dictionary.labels.todayFollowupsTitle],
  );

  const visibleNavItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (!user || !can(item.permission)) {
          return false;
        }

        if (item.superAdminOnly && !user.isSuperAdmin) {
          return false;
        }

        return true;
      }),
    [can, navItems, user],
  );

  const manualModules = useMemo<ManualModule[]>(() => {
    return visibleNavItems
      .map<ManualModule | null>((item) => {
        const description = MANUAL_DESCRIPTION_BY_ROUTE[item.to];
        if (!description) {
          return null;
        }

        return {
          id: item.to,
          title: item.label,
          description,
          route: item.to,
        };
      })
      .filter((module): module is ManualModule => module !== null);
  }, [visibleNavItems]);

  const mobilePrimaryNav = useMemo(() => visibleNavItems.slice(0, 4), [visibleNavItems]);
  const alternateTenants = useMemo(
    () => (user?.availableTenants ?? []).filter((tenant) => tenant.tenantId !== user?.tenantId),
    [user?.availableTenants, user?.tenantId],
  );
  const branchOptions = useMemo(() => buildBranchOptions(user), [user]);
  const canSwitchBranches = branchOptions.length > 1;
  const branchScopeLabel = useMemo(() => {
    if (!user) {
      return null;
    }

    return resolveBranchScopeLabel(branchOptions, selectedBranchId);
  }, [branchOptions, selectedBranchId, user]);

  const loadUnreadCount = useCallback(async (): Promise<void> => {
    if (!user) {
      setUnreadNotificationCount(0);
      return;
    }

    try {
      const response = await api.get<UnreadNotificationCount>('/v1/notifications/unread-count');
      setUnreadNotificationCount(response.count);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load notifications');
    }
  }, [user]);

  const loadNotifications = useCallback(async (): Promise<void> => {
    if (!user) {
      setNotifications([]);
      return;
    }

    setNotificationsLoading(true);

    try {
      const response = await api.get<NotificationListResponse>('/v1/notifications?page=1&pageSize=8&status=all');
      setNotifications(response.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load notifications');
    } finally {
      setNotificationsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadNotificationCount(0);
      return;
    }

    void loadUnreadCount();
    void loadNotifications();
  }, [loadNotifications, loadUnreadCount, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    return subscribeNotification((notification) => {
      setNotifications((current) => [notification, ...current.filter((item) => item.id !== notification.id)].slice(0, 8));
      void loadUnreadCount();
      toast.info(notification.title, {
        description: notification.message,
      });
    });
  }, [loadUnreadCount, subscribeNotification, user]);

  const markNotificationRead = useCallback(async (notificationId: string): Promise<void> => {
    const wasUnread = notifications.some((item) => item.id === notificationId && item.readAt === null);
    try {
      const response = await api.patch<NotificationMutationResult>('/v1/notifications/read', { notificationId });

      if (!response.success) {
        return;
      }

      setNotifications((current) =>
        current.map((item) =>
          item.id === notificationId
            ? {
                ...item,
                readAt: new Date(),
              }
            : item,
        ),
      );

      if (wasUnread) {
        setUnreadNotificationCount((current) => Math.max(0, current - 1));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark notification as read');
    }
  }, [notifications]);

  const markAllNotificationsRead = useCallback(async (): Promise<void> => {
    try {
      const response = await api.patch<NotificationMutationResult>('/v1/notifications/read-all', {});

      if (!response.success) {
        return;
      }

      const readAt = new Date();
      setNotifications((current) => current.map((item) => ({ ...item, readAt })));
      setUnreadNotificationCount(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark notifications as read');
    }
  }, []);

  const openNotification = useCallback(async (notification: AppNotification): Promise<void> => {
    if (notification.readAt === null) {
      await markNotificationRead(notification.id);
    }

    if (can('followups.view')) {
      void navigate('/staff/today');
      return;
    }

    if (can('enquiries.view')) {
      void navigate('/leads');
      return;
    }

    void navigate(defaultRoute);
  }, [can, defaultRoute, markNotificationRead, navigate]);

  const handleNotificationsOpenChange = useCallback((open: boolean): void => {
    if (!open) {
      return;
    }

    void loadUnreadCount();
    void loadNotifications();
  }, [loadNotifications, loadUnreadCount]);

  const handleLogout = (): void => {
    logout();
    void navigate('/login', { replace: true });
  };

  const handleHome = (): void => {
    void navigate(defaultRoute, { replace: true });
  };

  const openManualRoute = (route: string): void => {
    setManualOpen(false);
    setMobileOpen(false);
    void navigate(route);
  };

  const launchTour = (startStepId?: string): void => {
    setManualOpen(false);
    setSupportOpen(false);
    setMobileOpen(false);
    startTour(startStepId);
  };

  const handleTenantSwitch = (tenantId: string): void => {
    void (async () => {
      try {
        const response = await switchTenant(tenantId);
        await navigate(resolveDefaultRouteForPermissions(response.user.effectivePermissions), {
          replace: true,
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to switch tenant');
      }
    })();
  };

  const accentStyle = dictionary.theme?.accentColor
    ? ({ '--tenant-accent': dictionary.theme.accentColor } as React.CSSProperties)
    : undefined;
  const supportContacts = resolveSupportContacts({
    phone: import.meta.env.VITE_SUPPORT_PHONE as string | undefined,
    email: import.meta.env.VITE_SUPPORT_EMAIL as string | undefined,
  });

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
        <ShellSidebar
          dictionary={dictionary}
          profileIndustryPreset={profile?.industryPreset}
          sidebarCollapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
          onCloseMobile={() => setMobileOpen(false)}
          visibleNavItems={visibleNavItems}
          navTourId={navTourId}
          onNavigate={() => setMobileOpen(false)}
          onOpenManual={() => setManualOpen(true)}
          onOpenSupport={() => setSupportOpen(true)}
          branchOptions={branchOptions}
          canSwitchBranches={canSwitchBranches}
          branchScopeLabel={branchScopeLabel}
          selectedBranchId={selectedBranchId}
          setSelectedBranchId={setSelectedBranchId}
        />
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
        <ShellSidebar
          dictionary={dictionary}
          profileIndustryPreset={profile?.industryPreset}
          sidebarCollapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
          onCloseMobile={() => setMobileOpen(false)}
          visibleNavItems={visibleNavItems}
          navTourId={navTourId}
          onNavigate={() => setMobileOpen(false)}
          onOpenManual={() => setManualOpen(true)}
          onOpenSupport={() => setSupportOpen(true)}
          branchOptions={branchOptions}
          canSwitchBranches={canSwitchBranches}
          branchScopeLabel={branchScopeLabel}
          selectedBranchId={selectedBranchId}
          setSelectedBranchId={setSelectedBranchId}
        />
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <ShellHeader
          user={user}
          dictionary={dictionary}
          profileIndustryPreset={profile?.industryPreset}
          alternateTenants={alternateTenants}
          onTenantSwitch={handleTenantSwitch}
          onLogout={handleLogout}
          onHome={handleHome}
          onToggleMobile={() => setMobileOpen((prev) => !prev)}
          branchOptions={branchOptions}
          canSwitchBranches={canSwitchBranches}
          branchScopeLabel={branchScopeLabel}
          selectedBranchId={selectedBranchId}
          setSelectedBranchId={setSelectedBranchId}
          notifications={notifications}
          notificationsLoading={notificationsLoading}
          unreadNotificationCount={unreadNotificationCount}
          onNotificationsOpenChange={handleNotificationsOpenChange}
          onMarkNotificationRead={markNotificationRead}
          onMarkAllNotificationsRead={markAllNotificationsRead}
          onOpenNotification={openNotification}
        />

        <main data-tour-id="workspace-main" className="flex-1 px-3 pb-24 pt-5 sm:px-6 sm:pb-28 lg:px-8 lg:pb-8">
          <Outlet />
        </main>

        <ShellBottomNav mobilePrimaryNav={mobilePrimaryNav} navTourId={navTourId} />
      </div>

      <UserManualDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        manualModules={manualModules}
        onLaunchTour={() => launchTour()}
        onOpenSupport={() => {
          setManualOpen(false);
          setSupportOpen(true);
        }}
        onOpenRoute={openManualRoute}
      />

      <SupportDialog
        open={supportOpen}
        onOpenChange={setSupportOpen}
        supportPhone={supportContacts.supportPhone}
        supportEmail={supportContacts.supportEmail}
        supportPhoneHref={supportContacts.supportPhoneHref}
        onLaunchTour={() => launchTour()}
        onOpenManual={() => {
          setSupportOpen(false);
          setManualOpen(true);
        }}
      />
    </div>
  );
}
