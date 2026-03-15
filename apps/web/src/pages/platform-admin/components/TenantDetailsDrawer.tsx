import React from 'react';
import type { PlatformTenantDetails, PlatformTenantRole } from '@leadops/shared';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../../components/ui/sheet';
import { RefreshButton } from '../../../components/ui/refresh-button';
import { Skeleton } from '../../../components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import type { DrawerTab, TenantSettingsDraft } from '../platform-admin.types';
import { AuditTab } from './drawer-tabs/AuditTab';
import { BranchesTab } from './drawer-tabs/BranchesTab';
import { RolesTab } from './drawer-tabs/RolesTab';
import { SettingsTab } from './drawer-tabs/SettingsTab';
import { TenantTab } from './drawer-tabs/TenantTab';
import { UsersTab } from './drawer-tabs/UsersTab';

type TenantDetailsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drawerTab: DrawerTab;
  setDrawerTab: React.Dispatch<React.SetStateAction<DrawerTab>>;
  tenantDetails: PlatformTenantDetails | null;
  tenantDetailsLoading: boolean;
  onRefresh: () => void;
  refreshLoading: boolean;

  usersPageMeta: PlatformTenantDetails['usersPage'];
  auditPageMeta: PlatformTenantDetails['auditEventsPage'];

  tenantRoles: PlatformTenantRole[];
  tenantRolesLoading: boolean;
  tenantSettingsDraft: TenantSettingsDraft | null;
  setTenantSettingsDraft: React.Dispatch<React.SetStateAction<TenantSettingsDraft | null>>;
  drawerTimezoneSearch: string;
  setDrawerTimezoneSearch: React.Dispatch<React.SetStateAction<string>>;
  visibleDrawerTimezoneOptions: Array<{ label: string; value: string; deprecated?: boolean }>;
  savingTenantSettings: boolean;

  togglingBranchId: string | null;

  onOpenEditUser: (user: PlatformTenantDetails['users'][number]) => void;
  onOpenPassword: (user: PlatformTenantDetails['users'][number]) => void;
  onUsersPrev: () => void;
  onUsersNext: () => void;

  onOpenCreateBranch: () => void;
  onOpenEditBranch: (branch: PlatformTenantDetails['branches'][number]) => void;
  onToggleBranchStatus: (branch: PlatformTenantDetails['branches'][number]) => void;

  onOpenCreateRole: () => void;
  onOpenEditRole: (role: PlatformTenantRole) => void;

  onSaveSettings: () => void;

  onAuditPrev: () => void;
  onAuditNext: () => void;
};

export function TenantDetailsDrawer(props: TenantDetailsDrawerProps): React.JSX.Element {
  const {
    open,
    onOpenChange,
    drawerTab,
    setDrawerTab,
    tenantDetails,
    tenantDetailsLoading,
    onRefresh,
    refreshLoading,
    usersPageMeta,
    auditPageMeta,
    tenantRoles,
    tenantRolesLoading,
    tenantSettingsDraft,
    setTenantSettingsDraft,
    drawerTimezoneSearch,
    setDrawerTimezoneSearch,
    visibleDrawerTimezoneOptions,
    savingTenantSettings,
    togglingBranchId,
    onOpenEditUser,
    onOpenPassword,
    onUsersPrev,
    onUsersNext,
    onOpenCreateBranch,
    onOpenEditBranch,
    onToggleBranchStatus,
    onOpenCreateRole,
    onOpenEditRole,
    onSaveSettings,
    onAuditPrev,
    onAuditNext,
  } = props;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-4xl">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle>{tenantDetails?.tenant.name ?? 'Tenant details'}</SheetTitle>
              <SheetDescription>
                Inspect tenant settings, users, branches, and recent audit events.
              </SheetDescription>
            </div>
            <RefreshButton loading={refreshLoading} onClick={onRefresh} />
          </div>
        </SheetHeader>

        {tenantDetailsLoading || !tenantDetails ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <Tabs value={drawerTab} onValueChange={(value) => setDrawerTab(value as DrawerTab)} className="mt-5 space-y-4">
            <TabsList>
              <TabsTrigger value="tenant">Tenant</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="branches">Branches</TabsTrigger>
              <TabsTrigger value="roles">Roles</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="audit">Audit</TabsTrigger>
            </TabsList>

            <TabsContent value="tenant" className="space-y-4">
              <TenantTab tenant={tenantDetails.tenant} />
            </TabsContent>

            <TabsContent value="users" className="space-y-3">
              <UsersTab
                users={tenantDetails.users}
                usersPageMeta={usersPageMeta}
                tenantDetailsLoading={tenantDetailsLoading}
                onOpenEdit={onOpenEditUser}
                onOpenPassword={onOpenPassword}
                onPrevPage={onUsersPrev}
                onNextPage={onUsersNext}
              />
            </TabsContent>

            <TabsContent value="branches" className="space-y-3">
              <BranchesTab
                branches={tenantDetails.branches}
                togglingBranchId={togglingBranchId}
                onCreateBranch={onOpenCreateBranch}
                onEditBranch={onOpenEditBranch}
                onToggleStatus={onToggleBranchStatus}
              />
            </TabsContent>

            <TabsContent value="roles" className="space-y-3">
              <RolesTab
                tenantRolesLoading={tenantRolesLoading}
                tenantRoles={tenantRoles}
                onCreateRole={onOpenCreateRole}
                onEditRole={onOpenEditRole}
              />
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <SettingsTab
                tenantSettingsDraft={tenantSettingsDraft}
                setTenantSettingsDraft={setTenantSettingsDraft}
                drawerTimezoneSearch={drawerTimezoneSearch}
                setDrawerTimezoneSearch={setDrawerTimezoneSearch}
                visibleDrawerTimezoneOptions={visibleDrawerTimezoneOptions}
                savingTenantSettings={savingTenantSettings}
                onSave={onSaveSettings}
              />
            </TabsContent>

            <TabsContent value="audit" className="space-y-3">
              <AuditTab
                auditEvents={tenantDetails.auditEvents}
                auditPageMeta={auditPageMeta}
                tenantDetailsLoading={tenantDetailsLoading}
                onPrevPage={onAuditPrev}
                onNextPage={onAuditNext}
              />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
