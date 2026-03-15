import React from 'react';
import type { AuthUser, Notification } from '@leadops/shared';
import { BellRing, Menu, Sparkles } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import type { UiDictionary } from '../../../lib/ui-dictionary';
import { industryPresetLabel } from '../../../lib/industry-preset';
import { BranchSwitcher } from './BranchSwitcher';
import type { BranchOption } from '../../../lib/branch-scope';

type TenantOption = {
  tenantId: string;
  tenantName: string;
};

type ShellHeaderProps = {
  user: AuthUser | null;
  dictionary: UiDictionary;
  profileIndustryPreset?: string;
  alternateTenants: TenantOption[];
  onTenantSwitch: (tenantId: string) => void;
  onLogout: () => void;
  onHome: () => void;
  onToggleMobile: () => void;

  branchOptions: BranchOption[];
  canSwitchBranches: boolean;
  branchScopeLabel: string | null;
  selectedBranchId: string | null;
  setSelectedBranchId: (value: string | null) => void;
  notifications: Notification[];
  notificationsLoading: boolean;
  unreadNotificationCount: number;
  onNotificationsOpenChange: (open: boolean) => void;
  onMarkNotificationRead: (notificationId: string) => Promise<void>;
  onMarkAllNotificationsRead: () => Promise<void>;
  onOpenNotification: (notification: Notification) => Promise<void>;
};

type NotificationMenuProps = Pick<
  ShellHeaderProps,
  | 'notifications'
  | 'notificationsLoading'
  | 'unreadNotificationCount'
  | 'onNotificationsOpenChange'
  | 'onMarkNotificationRead'
  | 'onMarkAllNotificationsRead'
  | 'onOpenNotification'
>;

function NotificationMenu({
  notifications,
  notificationsLoading,
  unreadNotificationCount,
  onNotificationsOpenChange,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onOpenNotification,
}: NotificationMenuProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  const handleOpenChange = (next: boolean): void => {
    setOpen(next);
    onNotificationsOpenChange(next);
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="relative rounded-2xl">
          <BellRing className="h-4 w-4" />
          {unreadNotificationCount > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] rounded-2xl p-0">
        <div className="border-b px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-xs text-muted-foreground">
                {unreadNotificationCount > 0 ? `${unreadNotificationCount} unread` : 'All caught up'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-xl px-2 text-xs"
              disabled={unreadNotificationCount === 0}
              onClick={() => void onMarkAllNotificationsRead()}
            >
              Mark all read
            </Button>
          </div>
        </div>

        <div className="max-h-[22rem] overflow-y-auto p-2">
          {notificationsLoading ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">Loading notifications...</div>
          ) : notifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">No notifications yet.</div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className="rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-secondary/50"
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => {
                    setOpen(false);
                    void onOpenNotification(notification);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{notification.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{notification.message}</p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {notification.readAt === null ? (
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--tenant-accent,#2f90b7)]" />
                    ) : null}
                  </div>
                </button>
                {notification.readAt === null ? (
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-lg px-2 text-[11px]"
                      onClick={() => void onMarkNotificationRead(notification.id)}
                    >
                      Mark read
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ShellHeader(props: ShellHeaderProps): React.JSX.Element {
  const {
    user,
    dictionary,
    profileIndustryPreset,
    alternateTenants,
    onTenantSwitch,
    onLogout,
    onHome,
    onToggleMobile,
    branchOptions,
    canSwitchBranches,
    branchScopeLabel,
    selectedBranchId,
    setSelectedBranchId,
    notifications,
    notificationsLoading,
    unreadNotificationCount,
    onNotificationsOpenChange,
    onMarkNotificationRead,
    onMarkAllNotificationsRead,
    onOpenNotification,
  } = props;

  return (
    <header className="sticky top-0 z-30 px-3 pt-2 sm:px-4 sm:pt-3 lg:px-6 xl:px-8">
      <div className="overflow-hidden rounded-b-[2rem] border-x border-b border-white/80 bg-background/90 px-4 py-4 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.45)] backdrop-blur sm:rounded-[1.75rem] sm:border sm:px-5 xl:rounded-[2rem] xl:border-0 xl:bg-[linear-gradient(180deg,rgba(255,255,255,0.52),rgba(239,248,248,0.68))] xl:px-6 xl:py-4 xl:shadow-[0_18px_40px_-34px_rgba(15,23,42,0.28)] xl:backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 xl:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-2xl"
              onClick={onToggleMobile}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <p className="max-w-[11rem] truncate text-lg font-semibold leading-none sm:max-w-[16rem] sm:text-xl">
                Welcome{user?.name ? `, ${user.name}` : ''}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <NotificationMenu
              notifications={notifications}
              notificationsLoading={notificationsLoading}
              unreadNotificationCount={unreadNotificationCount}
              onNotificationsOpenChange={onNotificationsOpenChange}
              onMarkNotificationRead={onMarkNotificationRead}
              onMarkAllNotificationsRead={onMarkAllNotificationsRead}
              onOpenNotification={onOpenNotification}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  data-tour-id="workspace-home"
                  variant="outline"
                  className="h-10 max-w-[8.5rem] rounded-2xl px-3 text-left sm:max-w-none"
                >
                  <span className="truncate">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {alternateTenants.map((tenant) => (
                  <DropdownMenuItem key={tenant.tenantId} onClick={() => onTenantSwitch(tenant.tenantId)}>
                    Switch to {tenant.tenantName}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={onLogout}>Logout</DropdownMenuItem>
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
                  data-tour-id="workspace-home"
                  className="mt-1 truncate text-left text-lg font-semibold leading-none sm:text-xl"
                  onClick={onHome}
                >
                  {dictionary.tenantName}
                </button>
                {dictionary.labels.sidebarSubtitle ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{dictionary.labels.sidebarSubtitle}</p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <NotificationMenu
                notifications={notifications}
                notificationsLoading={notificationsLoading}
                unreadNotificationCount={unreadNotificationCount}
                onNotificationsOpenChange={onNotificationsOpenChange}
                onMarkNotificationRead={onMarkNotificationRead}
                onMarkAllNotificationsRead={onMarkAllNotificationsRead}
                onOpenNotification={onOpenNotification}
              />

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
                  {alternateTenants.map((tenant) => (
                    <DropdownMenuItem key={tenant.tenantId} onClick={() => onTenantSwitch(tenant.tenantId)}>
                      Switch to {tenant.tenantName}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onClick={onLogout}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <BranchSwitcher
              variant="header"
              branchOptions={branchOptions}
              canSwitchBranches={canSwitchBranches}
              branchScopeLabel={branchScopeLabel}
              selectedBranchId={selectedBranchId}
              setSelectedBranchId={setSelectedBranchId}
            />
            {profileIndustryPreset ? (
              <Badge variant="outline" className="rounded-full border-white/70 bg-background/90 px-3 py-1">
                {industryPresetLabel(profileIndustryPreset)}
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
  );
}
