import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Skeleton } from '../../components/ui/skeleton';
import { PlatformAdminSummaryCards } from './components/PlatformAdminSummaryCards';
import { TenantDirectoryCard } from './components/TenantDirectoryCard';
import { TenantDetailsDrawer } from './components/TenantDetailsDrawer';
import { CreateTenantDialog } from './components/dialogs/CreateTenantDialog';
import { CreateAccessDialog } from './components/dialogs/CreateAccessDialog';
import { RoleDialog } from './components/dialogs/RoleDialog';
import { CreateBranchDialog } from './components/dialogs/CreateBranchDialog';
import { EditBranchDialog } from './components/dialogs/EditBranchDialog';
import { EditUserDialog } from './components/dialogs/EditUserDialog';
import { ResetPasswordDialog } from './components/dialogs/ResetPasswordDialog';
import { usePlatformAdminDrawer } from './usePlatformAdminDrawer';
import { usePlatformAdminList } from './usePlatformAdminList';

export function PlatformAdminPageView(): React.JSX.Element {
  const { user: currentUser } = useAuth();
  const list = usePlatformAdminList();
  const drawer = usePlatformAdminDrawer({
    currentUserId: currentUser?.id,
    onRefreshSummary: list.loadSummary,
  });

  const handleCreateTenant = (): void => {
    void list.runCreateTenant(async () => {
      if (drawer.drawerTenantId) {
        await drawer.reloadCurrentTenantDetails();
      }
    });
  };

  const handleCreateMembership = (): void => {
    void list.runCreateMembership(async () => {
      if (drawer.drawerTenantId) {
        await drawer.reloadCurrentTenantDetails();
      }
    });
  };

  const handleRefreshDirectory = (): void => {
    void Promise.all([list.loadSummary(), list.loadTenants()]);
  };

  const handleRefreshDrawer = (): void => {
    void drawer.refreshCurrentDrawerData();
  };

  if ((list.summaryLoading && !list.summary) || (list.tenantsLoading && list.tenants.length === 0)) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full rounded-3xl" />
        <Skeleton className="h-20 w-full rounded-3xl" />
        <Skeleton className="h-96 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PlatformAdminSummaryCards summary={list.summary} />

      <TenantDirectoryCard
        queryInput={list.queryInput}
        onQueryInputChange={list.setQueryInput}
        sortBy={list.sortBy}
        onSortByChange={(value) => {
          list.updateListParams({ sortBy: value, page: '1' });
        }}
        sortOrder={list.sortOrder}
        onSortOrderChange={(value) => {
          list.updateListParams({ sortOrder: value, page: '1' });
        }}
        onCreateTenant={() => list.setCreateTenantOpen(true)}
        onCreateAccess={() => list.setCreateAccessOpen(true)}
        onRefresh={handleRefreshDirectory}
        tenants={list.tenants}
        tableEmpty={list.tableEmpty}
        onOpenTenant={drawer.openTenantDrawer}
        page={list.page}
        totalPages={list.totalPages}
        total={list.total}
        tenantsLoading={list.tenantsLoading}
        tableFooterLabel={list.tableFooterLabel}
        onPrevPage={() => list.updateListParams({ page: String(list.page - 1) })}
        onNextPage={() => list.updateListParams({ page: String(list.page + 1) })}
      />

      <TenantDetailsDrawer
        open={drawer.drawerTenantId !== null}
        onOpenChange={(open) => {
          if (!open) {
            drawer.closeTenantDrawer();
          }
        }}
        drawerTab={drawer.drawerTab}
        setDrawerTab={drawer.setDrawerTab}
        tenantDetails={drawer.tenantDetails}
        tenantDetailsLoading={drawer.tenantDetailsLoading}
        onRefresh={handleRefreshDrawer}
        refreshLoading={drawer.tenantDetailsLoading || drawer.tenantRolesLoading}
        usersPageMeta={drawer.usersPageMeta}
        auditPageMeta={drawer.auditPageMeta}
        tenantRoles={drawer.tenantRoles}
        tenantRolesLoading={drawer.tenantRolesLoading}
        tenantSettingsDraft={drawer.tenantSettingsDraft}
        setTenantSettingsDraft={drawer.setTenantSettingsDraft}
        drawerTimezoneSearch={drawer.drawerTimezoneSearch}
        setDrawerTimezoneSearch={drawer.setDrawerTimezoneSearch}
        visibleDrawerTimezoneOptions={drawer.visibleDrawerTimezoneOptions}
        savingTenantSettings={drawer.savingTenantSettings}
        togglingBranchId={drawer.togglingBranchId}
        onOpenEditUser={drawer.openEditDialog}
        onOpenPassword={drawer.openPasswordDialog}
        onUsersPrev={() => {
          if (!drawer.usersPageMeta || drawer.usersPageMeta.page <= 1) {
            return;
          }
          drawer.onUsersPageChange(drawer.usersPageMeta.page - 1);
        }}
        onUsersNext={() => {
          if (!drawer.usersPageMeta || drawer.usersPageMeta.page >= drawer.usersPageMeta.totalPages) {
            return;
          }
          drawer.onUsersPageChange(drawer.usersPageMeta.page + 1);
        }}
        onOpenCreateBranch={drawer.openCreateBranchDialog}
        onOpenEditBranch={drawer.openEditBranchDialog}
        onToggleBranchStatus={(branch) => {
          void drawer.toggleBranchStatus(branch);
        }}
        onOpenCreateRole={drawer.openCreateRoleDialog}
        onOpenEditRole={drawer.openEditRoleDialog}
        onSaveSettings={() => {
          void drawer.saveTenantSettings();
        }}
        onAuditPrev={() => {
          if (!drawer.auditPageMeta || drawer.auditPageMeta.page <= 1) {
            return;
          }
          drawer.onAuditPageChange(drawer.auditPageMeta.page - 1);
        }}
        onAuditNext={() => {
          if (!drawer.auditPageMeta || drawer.auditPageMeta.page >= drawer.auditPageMeta.totalPages) {
            return;
          }
          drawer.onAuditPageChange(drawer.auditPageMeta.page + 1);
        }}
      />

      <CreateTenantDialog
        open={list.createTenantOpen}
        onOpenChange={list.setCreateTenantOpen}
        tenantForm={list.tenantForm}
        setTenantForm={list.setTenantForm}
        savingTenant={list.savingTenant}
        onCreate={handleCreateTenant}
      />

      <CreateAccessDialog
        open={list.createAccessOpen}
        onOpenChange={list.setCreateAccessOpen}
        tenantOptionQuery={list.tenantOptionQuery}
        setTenantOptionQuery={list.setTenantOptionQuery}
        tenantOptions={list.tenantOptions}
        tenantOptionsLoading={list.tenantOptionsLoading}
        membershipForm={list.membershipForm}
        setMembershipForm={list.setMembershipForm}
        savingMembership={list.savingMembership}
        onCreate={handleCreateMembership}
      />

      <RoleDialog
        open={drawer.roleDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            drawer.closeRoleDialog();
          }
        }}
        editingRole={drawer.editingRole}
        roleForm={drawer.roleForm}
        setRoleForm={drawer.setRoleForm}
        roleFormError={drawer.roleFormError}
        savingRole={drawer.savingRole}
        permissionGroupsLoading={drawer.permissionGroupsLoading}
        permissionGroups={drawer.permissionGroups}
        onTogglePermission={drawer.toggleRolePermission}
        onToggleGroup={drawer.togglePermissionGroup}
        onClose={drawer.closeRoleDialog}
        onSave={() => {
          void drawer.saveRole();
        }}
      />

      <CreateBranchDialog
        open={drawer.createBranchOpen}
        onOpenChange={(open) => {
          if (!open) {
            drawer.closeCreateBranchDialog();
          }
        }}
        branchForm={drawer.branchForm}
        setBranchForm={drawer.setBranchForm}
        savingBranch={drawer.savingBranch}
        onClose={drawer.closeCreateBranchDialog}
        onCreate={() => {
          void drawer.createBranch();
        }}
      />

      <EditBranchDialog
        open={drawer.editBranchOpen}
        onOpenChange={(open) => {
          if (!open) {
            drawer.closeEditBranchDialog();
          }
        }}
        branchForm={drawer.branchForm}
        setBranchForm={drawer.setBranchForm}
        savingBranch={drawer.savingBranch}
        editingBranchId={drawer.editingBranchId}
        onClose={drawer.closeEditBranchDialog}
        onSave={() => {
          void drawer.updateBranch();
        }}
      />

      <EditUserDialog
        open={drawer.editingUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            drawer.closeEditDialog();
          }
        }}
        editingUser={drawer.editingUser}
        editUserForm={drawer.editUserForm}
        setEditUserForm={drawer.setEditUserForm}
        savingEdit={drawer.savingEdit}
        currentUserId={currentUser?.id}
        availableRoles={drawer.tenantDetails?.availableRoles ?? []}
        tenantBranches={drawer.tenantBranches}
        branchById={drawer.branchById}
        onClose={drawer.closeEditDialog}
        onSave={() => {
          void drawer.saveUserInfo();
        }}
      />

      <ResetPasswordDialog
        open={drawer.passwordUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            drawer.closePasswordDialog();
          }
        }}
        passwordUser={drawer.passwordUser}
        passwordForm={drawer.passwordForm}
        setPasswordForm={drawer.setPasswordForm}
        savingPassword={drawer.savingPassword}
        onClose={drawer.closePasswordDialog}
        onSave={() => {
          void drawer.savePassword();
        }}
      />
    </div>
  );
}
