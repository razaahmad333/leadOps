import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import type {
  CreateBranchDto,
  CreatePlatformTenantRoleDto,
  PermissionGroup,
  PlatformTenantDetails,
  PlatformTenantRole,
  ResetPlatformUserPasswordDto,
  UpdateBranchDto,
  UpdatePlatformTenantRoleDto,
  UpdatePlatformUserDto,
  UpdateTenantSettingsDto,
} from '@leadops/shared';
import { toast } from 'sonner';
import {
  buildTimezoneOptions,
  filterTimezoneOptions,
  isTimezoneSelectionValid,
  isValidBusinessTimeRange,
  normalizeTimezoneValue,
} from '../../lib/timezone-options';
import { BRANCH_SCOPE, DRAWER_AUDIT_PAGE_SIZE, DRAWER_USERS_PAGE_SIZE } from './platform-admin.constants';
import {
  buildEditUserForm,
  buildTenantSettingsDraft,
  emptyBranchForm,
  emptyPasswordForm,
  emptyRoleForm,
  toEditUserTarget,
} from './platform-admin.form-factories';
import {
  createTenantBranch,
  createTenantRole,
  getTenantDetails,
  listPermissionGroups,
  listTenantRoles,
  patchPlatformUser,
  patchTenantBranch,
  patchTenantRole,
  patchTenantSettings,
  resetPlatformUserPassword,
} from './platform-admin.api';
import type {
  BranchFormState,
  DrawerTab,
  EditUserFormState,
  EditUserTarget,
  PasswordFormState,
  PasswordTarget,
  RoleFormState,
  TenantSettingsDraft,
} from './platform-admin.types';

interface UsePlatformAdminDrawerArgs {
  currentUserId?: string;
  onRefreshSummary: () => Promise<void>;
}

export interface PlatformAdminDrawerState {
  drawerTenantId: string | null;
  drawerTab: DrawerTab;
  setDrawerTab: React.Dispatch<React.SetStateAction<DrawerTab>>;
  tenantDetails: PlatformTenantDetails | null;
  tenantDetailsLoading: boolean;
  drawerUsersPage: number;
  drawerAuditPage: number;

  tenantSettingsDraft: TenantSettingsDraft | null;
  setTenantSettingsDraft: React.Dispatch<React.SetStateAction<TenantSettingsDraft | null>>;
  drawerTimezoneSearch: string;
  setDrawerTimezoneSearch: React.Dispatch<React.SetStateAction<string>>;
  drawerTimezoneOptions: Array<{ label: string; value: string; deprecated?: boolean }>;
  visibleDrawerTimezoneOptions: Array<{ label: string; value: string; deprecated?: boolean }>;
  savingTenantSettings: boolean;

  editingUser: EditUserTarget | null;
  editUserForm: EditUserFormState | null;
  setEditUserForm: React.Dispatch<React.SetStateAction<EditUserFormState | null>>;
  savingEdit: boolean;

  createBranchOpen: boolean;
  editBranchOpen: boolean;
  editingBranchId: string | null;
  branchForm: BranchFormState;
  setBranchForm: React.Dispatch<React.SetStateAction<BranchFormState>>;
  savingBranch: boolean;
  togglingBranchId: string | null;

  tenantRoles: PlatformTenantRole[];
  tenantRolesLoading: boolean;
  permissionGroups: PermissionGroup[];
  permissionGroupsLoading: boolean;
  roleDialogOpen: boolean;
  editingRole: PlatformTenantRole | null;
  roleForm: RoleFormState;
  setRoleForm: React.Dispatch<React.SetStateAction<RoleFormState>>;
  roleFormError: string | null;
  savingRole: boolean;

  passwordUser: PasswordTarget | null;
  passwordForm: PasswordFormState;
  setPasswordForm: React.Dispatch<React.SetStateAction<PasswordFormState>>;
  savingPassword: boolean;

  usersPageMeta: PlatformTenantDetails['usersPage'];
  auditPageMeta: PlatformTenantDetails['auditEventsPage'];
  tenantBranches: PlatformTenantDetails['branches'];
  branchById: Map<string, PlatformTenantDetails['branches'][number]>;

  openTenantDrawer: (tenantId: string) => void;
  closeTenantDrawer: () => void;
  reloadCurrentTenantDetails: () => Promise<void>;
  onUsersPageChange: (nextPage: number) => void;
  onAuditPageChange: (nextPage: number) => void;

  saveTenantSettings: () => Promise<void>;

  openEditDialog: (user: PlatformTenantDetails['users'][number]) => void;
  closeEditDialog: () => void;
  saveUserInfo: () => Promise<void>;

  openCreateRoleDialog: () => void;
  openEditRoleDialog: (role: PlatformTenantRole) => void;
  closeRoleDialog: () => void;
  toggleRolePermission: (permissionKey: string, checked: boolean) => void;
  togglePermissionGroup: (group: PermissionGroup) => void;
  saveRole: () => Promise<void>;

  openCreateBranchDialog: () => void;
  openEditBranchDialog: (branch: PlatformTenantDetails['branches'][number]) => void;
  closeCreateBranchDialog: () => void;
  closeEditBranchDialog: () => void;
  createBranch: () => Promise<void>;
  updateBranch: () => Promise<void>;
  toggleBranchStatus: (branch: PlatformTenantDetails['branches'][number]) => Promise<void>;

  openPasswordDialog: (user: PlatformTenantDetails['users'][number]) => void;
  closePasswordDialog: () => void;
  savePassword: () => Promise<void>;
}

export function usePlatformAdminDrawer(args: UsePlatformAdminDrawerArgs): PlatformAdminDrawerState {
  const { currentUserId, onRefreshSummary } = args;

  const [drawerTenantId, setDrawerTenantId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('tenant');
  const [tenantDetails, setTenantDetails] = useState<PlatformTenantDetails | null>(null);
  const [tenantDetailsLoading, setTenantDetailsLoading] = useState(false);
  const [drawerUsersPage, setDrawerUsersPage] = useState(1);
  const [drawerAuditPage, setDrawerAuditPage] = useState(1);

  const [savingTenantSettings, setSavingTenantSettings] = useState(false);
  const [tenantSettingsDraft, setTenantSettingsDraft] = useState<TenantSettingsDraft | null>(null);
  const [drawerTimezoneSearch, setDrawerTimezoneSearch] = useState('');

  const [editingUser, setEditingUser] = useState<EditUserTarget | null>(null);
  const [editUserForm, setEditUserForm] = useState<EditUserFormState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [editBranchOpen, setEditBranchOpen] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchForm, setBranchForm] = useState<BranchFormState>(emptyBranchForm);
  const [savingBranch, setSavingBranch] = useState(false);
  const [togglingBranchId, setTogglingBranchId] = useState<string | null>(null);

  const [tenantRoles, setTenantRoles] = useState<PlatformTenantRole[]>([]);
  const [tenantRolesLoading, setTenantRolesLoading] = useState(false);
  const [permissionGroups, setPermissionGroups] = useState<PermissionGroup[]>([]);
  const [permissionGroupsLoading, setPermissionGroupsLoading] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<PlatformTenantRole | null>(null);
  const [roleForm, setRoleForm] = useState<RoleFormState>(emptyRoleForm);
  const [roleFormError, setRoleFormError] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState(false);

  const [passwordUser, setPasswordUser] = useState<PasswordTarget | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyPasswordForm);
  const [savingPassword, setSavingPassword] = useState(false);

  const drawerTimezoneOptions = useMemo(
    () => buildTimezoneOptions(tenantDetails?.settings.timezone ?? tenantSettingsDraft?.timezone ?? ''),
    [tenantDetails?.settings.timezone, tenantSettingsDraft?.timezone],
  );

  const visibleDrawerTimezoneOptions = useMemo(
    () => filterTimezoneOptions(drawerTimezoneOptions, drawerTimezoneSearch, tenantSettingsDraft?.timezone ?? ''),
    [drawerTimezoneOptions, drawerTimezoneSearch, tenantSettingsDraft?.timezone],
  );

  const usersPageMeta = tenantDetails?.usersPage;
  const auditPageMeta = tenantDetails?.auditEventsPage;
  const tenantBranches = tenantDetails?.branches ?? [];
  const branchById = useMemo(() => new Map(tenantBranches.map((branch) => [branch.id, branch])), [tenantBranches]);

  const loadTenantDetails = useCallback(async (
    tenantId: string,
    nextUsersPage: number,
    nextAuditPage: number,
  ): Promise<void> => {
    setTenantDetailsLoading(true);
    try {
      const response = await getTenantDetails(tenantId, {
        usersPage: nextUsersPage,
        usersPageSize: DRAWER_USERS_PAGE_SIZE,
        auditPage: nextAuditPage,
        auditPageSize: DRAWER_AUDIT_PAGE_SIZE,
      });

      setTenantDetails(response);
      setTenantSettingsDraft(buildTenantSettingsDraft(response.settings));
      setDrawerTimezoneSearch('');
      setDrawerUsersPage(response.usersPage?.page ?? nextUsersPage);
      setDrawerAuditPage(response.auditEventsPage?.page ?? nextAuditPage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load tenant details');
      setTenantDetails(null);
      setTenantSettingsDraft(null);
    } finally {
      setTenantDetailsLoading(false);
    }
  }, []);

  const loadTenantRoles = useCallback(async (tenantId: string): Promise<void> => {
    setTenantRolesLoading(true);
    try {
      const response = await listTenantRoles(tenantId);
      setTenantRoles(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load roles');
      setTenantRoles([]);
    } finally {
      setTenantRolesLoading(false);
    }
  }, []);

  const loadPermissionCatalog = useCallback(async (): Promise<void> => {
    if (permissionGroups.length > 0) {
      return;
    }

    setPermissionGroupsLoading(true);
    try {
      const response = await listPermissionGroups();
      setPermissionGroups(response);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load permissions catalog');
      setPermissionGroups([]);
    } finally {
      setPermissionGroupsLoading(false);
    }
  }, [permissionGroups.length]);

  useEffect(() => {
    if (!drawerTenantId || drawerTab !== 'roles') {
      return;
    }

    void loadTenantRoles(drawerTenantId);
    void loadPermissionCatalog();
  }, [drawerTenantId, drawerTab, loadPermissionCatalog, loadTenantRoles]);

  const openTenantDrawer = useCallback((tenantId: string): void => {
    setDrawerTenantId(tenantId);
    setDrawerTab('tenant');
    setTenantDetails(null);
    setTenantRoles([]);
    setTenantSettingsDraft(null);
    setDrawerTimezoneSearch('');
    setDrawerUsersPage(1);
    setDrawerAuditPage(1);
    setRoleDialogOpen(false);
    setEditingRole(null);
    setRoleForm(emptyRoleForm());
    setRoleFormError(null);
    void loadTenantDetails(tenantId, 1, 1);
  }, [loadTenantDetails]);

  const closeTenantDrawer = useCallback((): void => {
    setDrawerTenantId(null);
    setTenantDetails(null);
    setTenantRoles([]);
    setTenantSettingsDraft(null);
    setDrawerTimezoneSearch('');
    setDrawerTab('tenant');
    setDrawerUsersPage(1);
    setDrawerAuditPage(1);
    setRoleDialogOpen(false);
    setEditingRole(null);
    setRoleForm(emptyRoleForm());
    setRoleFormError(null);
    setCreateBranchOpen(false);
    setEditBranchOpen(false);
    setEditingBranchId(null);
    setBranchForm(emptyBranchForm());
    setEditingUser(null);
    setEditUserForm(null);
    setPasswordUser(null);
    setPasswordForm(emptyPasswordForm());
  }, []);

  const reloadCurrentTenantDetails = useCallback(async (): Promise<void> => {
    if (!drawerTenantId) {
      return;
    }

    await loadTenantDetails(drawerTenantId, drawerUsersPage, drawerAuditPage);
  }, [drawerTenantId, drawerUsersPage, drawerAuditPage, loadTenantDetails]);

  const onUsersPageChange = useCallback((nextPage: number): void => {
    if (!drawerTenantId) {
      return;
    }

    setDrawerUsersPage(nextPage);
    void loadTenantDetails(drawerTenantId, nextPage, drawerAuditPage);
  }, [drawerAuditPage, drawerTenantId, loadTenantDetails]);

  const onAuditPageChange = useCallback((nextPage: number): void => {
    if (!drawerTenantId) {
      return;
    }

    setDrawerAuditPage(nextPage);
    void loadTenantDetails(drawerTenantId, drawerUsersPage, nextPage);
  }, [drawerTenantId, drawerUsersPage, loadTenantDetails]);

  const saveTenantSettings = useCallback(async (): Promise<void> => {
    if (!drawerTenantId || !tenantSettingsDraft) {
      return;
    }

    const firstReminderMinutes = Number.parseInt(tenantSettingsDraft.firstReminderMinutes, 10);
    const escalationMinutes = Number.parseInt(tenantSettingsDraft.escalationMinutes, 10);
    const postReportFollowupDays = Number.parseInt(tenantSettingsDraft.postReportFollowupDays, 10);

    if (
      !Number.isFinite(firstReminderMinutes)
      || !Number.isFinite(escalationMinutes)
      || !Number.isFinite(postReportFollowupDays)
    ) {
      toast.error('Reminder values must be valid numbers');
      return;
    }

    const normalizedTimezone = normalizeTimezoneValue(tenantSettingsDraft.timezone);
    if (!isTimezoneSelectionValid(normalizedTimezone, drawerTimezoneOptions)) {
      toast.error('Select a valid timezone from dropdown');
      return;
    }

    if (!tenantSettingsDraft.businessStart || !tenantSettingsDraft.businessEnd) {
      toast.error('Business start and end time are required');
      return;
    }

    if (!isValidBusinessTimeRange(tenantSettingsDraft.businessStart, tenantSettingsDraft.businessEnd)) {
      toast.error('Business start must be earlier than business end');
      return;
    }

    setSavingTenantSettings(true);
    try {
      const payload: UpdateTenantSettingsDto = {
        timezone: normalizedTimezone,
        businessStart: tenantSettingsDraft.businessStart,
        businessEnd: tenantSettingsDraft.businessEnd,
        reminderRules: {
          firstReminderMinutes,
          escalationMinutes,
          postReportFollowupDays,
        },
      };

      await patchTenantSettings(drawerTenantId, payload);
      toast.success('Tenant settings updated');
      await loadTenantDetails(drawerTenantId, drawerUsersPage, drawerAuditPage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update tenant settings');
    } finally {
      setSavingTenantSettings(false);
    }
  }, [drawerTenantId, tenantSettingsDraft, drawerTimezoneOptions, loadTenantDetails, drawerUsersPage, drawerAuditPage]);

  const openEditDialog = useCallback((user: PlatformTenantDetails['users'][number]): void => {
    const target = toEditUserTarget(user);
    setEditingUser(target);
    setEditUserForm(buildEditUserForm(target));
  }, []);

  const closeEditDialog = useCallback((): void => {
    setEditingUser(null);
    setEditUserForm(null);
  }, []);

  const saveUserInfo = useCallback(async (): Promise<void> => {
    if (!editingUser || !editUserForm) {
      return;
    }

    if (editingUser.userId === currentUserId && editUserForm.status === 'INACTIVE') {
      toast.error('You cannot deactivate your own user');
      return;
    }

    setSavingEdit(true);
    try {
      const payload: UpdatePlatformUserDto = {
        name: editUserForm.name.trim(),
        email: editUserForm.email.trim().toLowerCase(),
        phone: editUserForm.phone.trim() || null,
        status: editUserForm.status,
      };

      if (!editingUser.isSuperAdmin && editUserForm.isTenantAdmin !== editingUser.isTenantAdmin) {
        payload.isTenantAdmin = editUserForm.isTenantAdmin;
      }

      const normalizedRoleIds = [...new Set(editUserForm.roleIds)];
      const currentRoleIds = [...new Set(editingUser.roleIds)];
      const sortedNextRoleIds = [...normalizedRoleIds].sort();
      const sortedCurrentRoleIds = [...currentRoleIds].sort();
      const rolesChanged = sortedNextRoleIds.length !== sortedCurrentRoleIds.length
        || sortedNextRoleIds.some((id, index) => id !== sortedCurrentRoleIds[index]);
      if (rolesChanged) {
        payload.roleIds = normalizedRoleIds;
      }

      const canManageBranchAccess = !editingUser.isSuperAdmin && !editUserForm.isTenantAdmin;
      if (canManageBranchAccess) {
        const normalizedBranchIds = [...new Set(editUserForm.branchIds)];

        if (editUserForm.scopeType === BRANCH_SCOPE.SELECTED && normalizedBranchIds.length === 0) {
          toast.error('Select at least one branch for a scoped user');
          return;
        }

        const currentBranchIds = [...new Set(editingUser.branchIds)];
        const sortedNext = [...normalizedBranchIds].sort();
        const sortedCurrent = [...currentBranchIds].sort();

        const branchScopeChanged =
          editUserForm.scopeType !== editingUser.branchScopeType
          || (
            editUserForm.scopeType === BRANCH_SCOPE.SELECTED
            && (sortedNext.length !== sortedCurrent.length
              || sortedNext.some((id, index) => id !== sortedCurrent[index]))
          );

        if (branchScopeChanged) {
          payload.branchScope = {
            scopeType: editUserForm.scopeType,
            branchIds: editUserForm.scopeType === BRANCH_SCOPE.SELECTED ? normalizedBranchIds : [],
          };
        }

        const nextDefaultBranchId = editUserForm.defaultBranchId.trim() || null;
        if (nextDefaultBranchId !== editingUser.defaultBranchId) {
          payload.defaultBranchId = nextDefaultBranchId;
        }
      }

      await patchPlatformUser(editingUser.userId, payload);
      toast.success('User updated');
      closeEditDialog();
      await onRefreshSummary();
      if (drawerTenantId) {
        await loadTenantDetails(drawerTenantId, drawerUsersPage, drawerAuditPage);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update user');
    } finally {
      setSavingEdit(false);
    }
  }, [
    editingUser,
    editUserForm,
    currentUserId,
    closeEditDialog,
    onRefreshSummary,
    drawerTenantId,
    loadTenantDetails,
    drawerUsersPage,
    drawerAuditPage,
  ]);

  const openCreateRoleDialog = useCallback((): void => {
    setEditingRole(null);
    setRoleForm(emptyRoleForm());
    setRoleFormError(null);
    setRoleDialogOpen(true);
    void loadPermissionCatalog();
  }, [loadPermissionCatalog]);

  const openEditRoleDialog = useCallback((role: PlatformTenantRole): void => {
    if (role.isSystem) {
      return;
    }

    setEditingRole(role);
    setRoleForm({
      name: role.name,
      description: role.description ?? '',
      permissionKeys: role.permissionKeys,
    });
    setRoleFormError(null);
    setRoleDialogOpen(true);
    void loadPermissionCatalog();
  }, [loadPermissionCatalog]);

  const closeRoleDialog = useCallback((): void => {
    setRoleDialogOpen(false);
    setEditingRole(null);
    setRoleForm(emptyRoleForm());
    setRoleFormError(null);
  }, []);

  const toggleRolePermission = useCallback((permissionKey: string, checked: boolean): void => {
    setRoleForm((current) => ({
      ...current,
      permissionKeys: checked
        ? [...new Set([...current.permissionKeys, permissionKey])]
        : current.permissionKeys.filter((key) => key !== permissionKey),
    }));
  }, []);

  const togglePermissionGroup = useCallback((group: PermissionGroup): void => {
    const groupKeys = group.permissions.map((permission) => permission.key);
    const hasAll = groupKeys.every((key) => roleForm.permissionKeys.includes(key));

    setRoleForm((current) => ({
      ...current,
      permissionKeys: hasAll
        ? current.permissionKeys.filter((key) => !groupKeys.includes(key))
        : [...new Set([...current.permissionKeys, ...groupKeys])],
    }));
  }, [roleForm.permissionKeys]);

  const saveRole = useCallback(async (): Promise<void> => {
    if (!drawerTenantId) {
      return;
    }

    if (roleForm.name.trim().length < 2) {
      setRoleFormError('Role name must be at least 2 characters.');
      return;
    }

    setRoleFormError(null);
    setSavingRole(true);
    try {
      if (editingRole) {
        const payload: UpdatePlatformTenantRoleDto = {
          name: roleForm.name.trim(),
          description: roleForm.description.trim() || null,
          permissionKeys: roleForm.permissionKeys,
        };
        await patchTenantRole(drawerTenantId, editingRole.id, payload);
        toast.success('Role updated');
      } else {
        const payload: CreatePlatformTenantRoleDto = {
          name: roleForm.name.trim(),
          description: roleForm.description.trim() || undefined,
          permissionKeys: roleForm.permissionKeys,
        };
        await createTenantRole(drawerTenantId, payload);
        toast.success('Role created');
      }

      closeRoleDialog();
      await Promise.all([
        loadTenantRoles(drawerTenantId),
        loadTenantDetails(drawerTenantId, drawerUsersPage, drawerAuditPage),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save role');
    } finally {
      setSavingRole(false);
    }
  }, [
    drawerTenantId,
    roleForm,
    editingRole,
    closeRoleDialog,
    loadTenantRoles,
    loadTenantDetails,
    drawerUsersPage,
    drawerAuditPage,
  ]);

  const openCreateBranchDialog = useCallback((): void => {
    setBranchForm(emptyBranchForm());
    setEditingBranchId(null);
    setCreateBranchOpen(true);
  }, []);

  const openEditBranchDialog = useCallback((branch: PlatformTenantDetails['branches'][number]): void => {
    setBranchForm({
      name: branch.name,
      description: branch.description ?? '',
    });
    setEditingBranchId(branch.id);
    setEditBranchOpen(true);
  }, []);

  const closeCreateBranchDialog = useCallback((): void => {
    setCreateBranchOpen(false);
    setBranchForm(emptyBranchForm());
  }, []);

  const closeEditBranchDialog = useCallback((): void => {
    setEditBranchOpen(false);
    setEditingBranchId(null);
    setBranchForm(emptyBranchForm());
  }, []);

  const createBranch = useCallback(async (): Promise<void> => {
    if (!drawerTenantId) {
      return;
    }

    const name = branchForm.name.trim();
    if (name.length < 2) {
      toast.error('Branch name must be at least 2 characters');
      return;
    }

    setSavingBranch(true);
    try {
      const payload: CreateBranchDto = {
        name,
        description: branchForm.description.trim() || undefined,
      };

      await createTenantBranch(drawerTenantId, payload);
      toast.success('Branch created');
      closeCreateBranchDialog();
      await loadTenantDetails(drawerTenantId, drawerUsersPage, drawerAuditPage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create branch');
    } finally {
      setSavingBranch(false);
    }
  }, [branchForm, closeCreateBranchDialog, drawerAuditPage, drawerTenantId, drawerUsersPage, loadTenantDetails]);

  const updateBranch = useCallback(async (): Promise<void> => {
    if (!drawerTenantId || !editingBranchId) {
      return;
    }

    const name = branchForm.name.trim();
    if (name.length < 2) {
      toast.error('Branch name must be at least 2 characters');
      return;
    }

    setSavingBranch(true);
    try {
      const payload: UpdateBranchDto = {
        name,
        description: branchForm.description.trim() || null,
      };

      await patchTenantBranch(drawerTenantId, editingBranchId, payload);
      toast.success('Branch updated');
      closeEditBranchDialog();
      await loadTenantDetails(drawerTenantId, drawerUsersPage, drawerAuditPage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update branch');
    } finally {
      setSavingBranch(false);
    }
  }, [
    drawerTenantId,
    editingBranchId,
    branchForm,
    closeEditBranchDialog,
    loadTenantDetails,
    drawerUsersPage,
    drawerAuditPage,
  ]);

  const toggleBranchStatus = useCallback(async (branch: PlatformTenantDetails['branches'][number]): Promise<void> => {
    if (!drawerTenantId) {
      return;
    }

    setTogglingBranchId(branch.id);
    try {
      const payload: UpdateBranchDto = {
        isActive: !branch.isActive,
      };

      await patchTenantBranch(drawerTenantId, branch.id, payload);
      toast.success(branch.isActive ? 'Branch deactivated' : 'Branch activated');
      await loadTenantDetails(drawerTenantId, drawerUsersPage, drawerAuditPage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update branch status');
    } finally {
      setTogglingBranchId(null);
    }
  }, [drawerTenantId, loadTenantDetails, drawerUsersPage, drawerAuditPage]);

  const openPasswordDialog = useCallback((user: PlatformTenantDetails['users'][number]): void => {
    setPasswordUser({ userId: user.id, email: user.email });
    setPasswordForm(emptyPasswordForm());
  }, []);

  const closePasswordDialog = useCallback((): void => {
    setPasswordUser(null);
    setPasswordForm(emptyPasswordForm());
  }, []);

  const savePassword = useCallback(async (): Promise<void> => {
    if (!passwordUser) {
      return;
    }

    if (passwordForm.password !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSavingPassword(true);
    try {
      const payload: ResetPlatformUserPasswordDto = {
        password: passwordForm.password,
      };

      await resetPlatformUserPassword(passwordUser.userId, payload);
      toast.success('Password updated');
      closePasswordDialog();
      if (drawerTenantId) {
        await loadTenantDetails(drawerTenantId, drawerUsersPage, drawerAuditPage);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  }, [
    passwordUser,
    passwordForm.password,
    passwordForm.confirmPassword,
    closePasswordDialog,
    drawerTenantId,
    loadTenantDetails,
    drawerUsersPage,
    drawerAuditPage,
  ]);

  return {
    drawerTenantId,
    drawerTab,
    setDrawerTab,
    tenantDetails,
    tenantDetailsLoading,
    drawerUsersPage,
    drawerAuditPage,

    tenantSettingsDraft,
    setTenantSettingsDraft,
    drawerTimezoneSearch,
    setDrawerTimezoneSearch,
    drawerTimezoneOptions,
    visibleDrawerTimezoneOptions,
    savingTenantSettings,

    editingUser,
    editUserForm,
    setEditUserForm,
    savingEdit,

    createBranchOpen,
    editBranchOpen,
    editingBranchId,
    branchForm,
    setBranchForm,
    savingBranch,
    togglingBranchId,

    tenantRoles,
    tenantRolesLoading,
    permissionGroups,
    permissionGroupsLoading,
    roleDialogOpen,
    editingRole,
    roleForm,
    setRoleForm,
    roleFormError,
    savingRole,

    passwordUser,
    passwordForm,
    setPasswordForm,
    savingPassword,

    usersPageMeta,
    auditPageMeta,
    tenantBranches,
    branchById,

    openTenantDrawer,
    closeTenantDrawer,
    reloadCurrentTenantDetails,
    onUsersPageChange,
    onAuditPageChange,

    saveTenantSettings,

    openEditDialog,
    closeEditDialog,
    saveUserInfo,

    openCreateRoleDialog,
    openEditRoleDialog,
    closeRoleDialog,
    toggleRolePermission,
    togglePermissionGroup,
    saveRole,

    openCreateBranchDialog,
    openEditBranchDialog,
    closeCreateBranchDialog,
    closeEditBranchDialog,
    createBranch,
    updateBranch,
    toggleBranchStatus,

    openPasswordDialog,
    closePasswordDialog,
    savePassword,
  };
}
