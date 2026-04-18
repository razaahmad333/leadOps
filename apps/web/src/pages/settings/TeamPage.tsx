import React, { useEffect, useMemo, useState } from 'react';
import type {
  Branch,
  BranchScopeType,
  CreateBranchDto,
  CreateUserDto,
  RoleSummary,
  TeamUser,
  UpdateBranchDto,
  UpdateUserDto,
  UserStatus,
} from '@leadops/shared';
import {
  Pencil,
  Plus,
  Shield,
  UserCog,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { PasswordInput } from '../../components/ui/password-input';
import { PasswordStrengthHints } from '../../components/ui/password-strength-hints';
import { RefreshButton } from '../../components/ui/refresh-button';
import { Select } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';

const BRANCH_SCOPE = {
  ALL_BRANCHES: 'ALL_BRANCHES' as BranchScopeType,
  SELECTED: 'SELECTED' as BranchScopeType,
};

const USER_STATUS = {
  ACTIVE: 'ACTIVE' as UserStatus,
  INACTIVE: 'INACTIVE' as UserStatus,
};

interface TeamFormState {
  name: string;
  email: string;
  phone: string;
  roleId: string;
  isTenantAdmin: boolean;
  scopeType: BranchScopeType;
  branchIds: string[];
  defaultBranchId: string;
  password: string;
  status: UserStatus;
}

interface BranchFormState {
  name: string;
  description: string;
}

function emptyForm(): TeamFormState {
  return {
    name: '',
    email: '',
    phone: '',
    roleId: '',
    isTenantAdmin: false,
    scopeType: BRANCH_SCOPE.ALL_BRANCHES,
    branchIds: [],
    defaultBranchId: '',
    password: '',
    status: USER_STATUS.ACTIVE,
  };
}

function emptyBranchForm(): BranchFormState {
  return {
    name: '',
    description: '',
  };
}

function branchSummary(user: TeamUser): string {
  if (user.branchScope.scopeType === BRANCH_SCOPE.ALL_BRANCHES) {
    return 'All branches';
  }

  return user.branchScope.branchNames.join(', ');
}

function statusVariant(status: UserStatus): 'success' | 'secondary' {
  return status === USER_STATUS.ACTIVE ? 'success' : 'secondary';
}

function branchStatusVariant(isActive: boolean): 'success' | 'secondary' {
  return isActive ? 'success' : 'secondary';
}

export function TeamPage(): React.JSX.Element {
  const { user: currentUser, can } = useAuth();
  const adminLabel = 'Full Access';
  const canManageBranches = can('branches.manage');

  const [users, setUsers] = useState<TeamUser[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [editBranchDialogOpen, setEditBranchDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingBranch, setCreatingBranch] = useState(false);
  const [updatingBranch, setUpdatingBranch] = useState(false);
  const [togglingBranchId, setTogglingBranchId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState<TeamFormState>(emptyForm);
  const [branchForm, setBranchForm] = useState<BranchFormState>(emptyBranchForm);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async (): Promise<void> => {
    setLoading(true);

    try {
      const [nextUsers, nextRoles, nextBranches] = await Promise.all([
        api.get<TeamUser[]>('/v1/users'),
        api.get<RoleSummary[]>('/v1/roles'),
        api.get<Branch[]>('/v1/branches'),
      ]);

      setUsers(nextUsers);
      setRoles(nextRoles);
      setBranches(nextBranches);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesQuery =
        query.trim().length === 0
        || `${user.name} ${user.email} ${user.phone ?? ''}`.toLowerCase().includes(query.trim().toLowerCase());
      const matchesRole =
        roleFilter === 'ALL'
        || user.roles.some((role) => role.id === roleFilter);
      const matchesStatus =
        statusFilter === 'ALL'
        || user.status === statusFilter;

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [query, roleFilter, statusFilter, users]);

  const openCreateDialog = (): void => {
    setEditingUser(null);
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
  };

  const openCreateBranchDialog = (): void => {
    setBranchForm(emptyBranchForm());
    setBranchDialogOpen(true);
  };

  const createBranch = async (): Promise<void> => {
    if (!canManageBranches) {
      return;
    }

    const name = branchForm.name.trim();
    if (name.length < 2) {
      toast.error('Branch name must be at least 2 characters');
      return;
    }

    setCreatingBranch(true);

    try {
      const payload: CreateBranchDto = {
        name,
        description: branchForm.description.trim() || undefined,
      };
      await api.post<Branch>('/v1/branches', payload);
      toast.success('Branch created');
      setBranchForm(emptyBranchForm());
      setBranchDialogOpen(false);
      await loadData();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Failed to create branch');
    } finally {
      setCreatingBranch(false);
    }
  };

  const openEditBranchDialog = (branch: Branch): void => {
    setEditingBranch(branch);
    setBranchForm({
      name: branch.name,
      description: branch.description ?? '',
    });
    setEditBranchDialogOpen(true);
  };

  const updateBranch = async (): Promise<void> => {
    if (!canManageBranches || !editingBranch) {
      return;
    }

    const name = branchForm.name.trim();
    if (name.length < 2) {
      toast.error('Branch name must be at least 2 characters');
      return;
    }

    setUpdatingBranch(true);
    try {
      const payload: UpdateBranchDto = {
        name,
        description: branchForm.description.trim() || null,
      };
      await api.patch<Branch>(`/v1/branches/${editingBranch.id}`, payload);
      toast.success('Branch updated');
      setEditBranchDialogOpen(false);
      setEditingBranch(null);
      setBranchForm(emptyBranchForm());
      await loadData();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Failed to update branch');
    } finally {
      setUpdatingBranch(false);
    }
  };

  const toggleBranchStatus = async (branch: Branch): Promise<void> => {
    if (!canManageBranches) {
      return;
    }

    setTogglingBranchId(branch.id);
    try {
      const payload: UpdateBranchDto = { isActive: !branch.isActive };
      await api.patch<Branch>(`/v1/branches/${branch.id}`, payload);
      toast.success(branch.isActive ? 'Branch deactivated' : 'Branch activated');
      await loadData();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Failed to update branch status');
    } finally {
      setTogglingBranchId(null);
    }
  };

  const openEditDialog = (user: TeamUser): void => {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      roleId: user.roles[0]?.id ?? '',
      isTenantAdmin: user.isTenantAdmin,
      scopeType: user.branchScope.scopeType,
      branchIds: user.branchScope.scopeType === BRANCH_SCOPE.SELECTED ? user.branchScope.branchIds : [],
      defaultBranchId: user.defaultBranchId ?? '',
      password: '',
      status: user.status,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const toggleBranch = (branchId: string, checked: boolean): void => {
    setForm((current) => ({
      ...current,
      branchIds: checked
        ? [...current.branchIds, branchId]
        : current.branchIds.filter((id) => id !== branchId),
    }));
  };

  const validate = (): string | null => {
    if (form.name.trim().length < 2) {
      return 'Name must be at least 2 characters.';
    }

    if (!editingUser && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      return 'Enter a valid email address.';
    }

    if (!editingUser && form.password.trim().length < 8) {
      return 'Password must be at least 8 characters.';
    }

    if (!form.isTenantAdmin && !form.roleId) {
      return 'Select a role for this user.';
    }

    if (
      !form.isTenantAdmin
      && form.scopeType === BRANCH_SCOPE.SELECTED
      && form.branchIds.length === 0
    ) {
      return 'Select at least one branch for a scoped user.';
    }

    if (
      editingUser
      && currentUser?.id === editingUser.id
      && form.status === USER_STATUS.INACTIVE
    ) {
      return 'You cannot deactivate your own user.';
    }

    return null;
  };

  const submit = async (): Promise<void> => {
    const error = validate();
    setFormError(error);

    if (error) {
      return;
    }

    setSaving(true);

    const payloadBase = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      roleId: form.isTenantAdmin ? undefined : form.roleId,
      isTenantAdmin: form.isTenantAdmin,
      branchScope: form.isTenantAdmin
        ? { scopeType: BRANCH_SCOPE.ALL_BRANCHES, branchIds: [] }
        : {
            scopeType: form.scopeType,
            branchIds: form.scopeType === BRANCH_SCOPE.SELECTED ? form.branchIds : [],
          },
      defaultBranchId: form.defaultBranchId || null,
    };

    try {
      if (editingUser) {
        const payload: UpdateUserDto = {
          ...payloadBase,
          status: form.status,
        };
        await api.patch<TeamUser>(`/v1/users/${editingUser.id}`, payload);
        toast.success('User updated');
      } else {
        const payload: CreateUserDto = {
          ...payloadBase,
          email: form.email.trim().toLowerCase(),
          password: form.password,
        };
        await api.post<TeamUser>('/v1/users', payload);
        toast.success('User created');
      }

      setDialogOpen(false);
      setForm(emptyForm());
      await loadData();
    } catch (requestError) {
      toast.error(requestError instanceof Error ? requestError.message : 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (user: TeamUser): Promise<void> => {
    const nextStatus =
      user.status === USER_STATUS.ACTIVE ? USER_STATUS.INACTIVE : USER_STATUS.ACTIVE;

    if (currentUser?.id === user.id && nextStatus === USER_STATUS.INACTIVE) {
      toast.error('You cannot deactivate your own user');
      return;
    }

    try {
      await api.patch<TeamUser>(`/v1/users/${user.id}`, {
        status: nextStatus,
      } satisfies UpdateUserDto);
      toast.success(nextStatus === USER_STATUS.ACTIVE ? 'User activated' : 'User deactivated');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update user status');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2 pt-2 sm:pt-3">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Access Control</p>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-muted-foreground">
            Manage tenant users, scoped access, and the {adminLabel.toLowerCase()} full-access flag.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <RefreshButton loading={loading} onClick={() => void loadData()} className="w-full sm:w-auto" />
          {canManageBranches ? (
            <Button
              variant="outline"
              onClick={openCreateBranchDialog}
              className="gap-2 w-full sm:w-auto"
            >
              <Plus className="h-4 w-4" />
              Add Branch
            </Button>
          ) : null}
          <Button data-tour-id="team-create-user" onClick={openCreateDialog} className="gap-2 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Create User
          </Button>
        </div>
      </div>

      <Card className="rounded-3xl border-white/80 bg-card/95">
        <CardHeader className="gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Directory</CardTitle>
            <CardDescription>Search, filter, and update team access without leaving the workspace.</CardDescription>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, email, or phone"
            />
            <Select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="ALL">All roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <TabsList className="grid w-full grid-cols-3 sm:inline-flex sm:w-auto">
              <TabsTrigger value="ALL" className="flex-1">All</TabsTrigger>
              <TabsTrigger value="ACTIVE" className="flex-1">Active</TabsTrigger>
              <TabsTrigger value="INACTIVE" className="flex-1">Inactive</TabsTrigger>
            </TabsList>
            <TabsContent value={statusFilter} className="pt-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-14 w-full" />
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <Card className="border-dashed bg-background/70">
                  <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
                    <UserCog className="h-8 w-8 text-muted-foreground" />
                    <p className="font-medium">No matching users</p>
                    <p className="text-sm text-muted-foreground">
                      Try a different filter or create a new user for this tenant.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="space-y-3 lg:hidden">
                    {filteredUsers.map((user) => (
                      <div key={user.id} className="rounded-2xl border border-white/70 bg-background/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{user.name}</p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{user.phone ?? 'No phone'}</p>
                            {user.isSuperAdmin ? (
                              <p className="mt-1 text-xs text-muted-foreground">Platform super admin</p>
                            ) : null}
                          </div>
                          <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {user.roleNames.map((roleName) => (
                            <Badge key={roleName} variant="secondary" className="whitespace-nowrap">
                              {roleName}
                            </Badge>
                          ))}
                          {user.isTenantAdmin ? (
                            <Badge variant="default" className="gap-1 whitespace-nowrap leading-none">
                              <Shield className="h-3 w-3 shrink-0" />
                              Full access
                            </Badge>
                          ) : null}
                        </div>

                        <p className="mt-3 text-sm text-muted-foreground">{branchSummary(user)}</p>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={currentUser?.id === user.id && user.status === USER_STATUS.ACTIVE}
                            title={
                              currentUser?.id === user.id && user.status === USER_STATUS.ACTIVE
                                ? 'You cannot deactivate your own user'
                                : undefined
                            }
                            onClick={() => void toggleStatus(user)}
                          >
                            {user.status === USER_STATUS.ACTIVE ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden lg:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Role(s)</TableHead>
                          <TableHead>{adminLabel}</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Branch Scope</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div>
                                <p className="font-semibold">{user.name}</p>
                                {user.isSuperAdmin ? (
                                  <p className="text-xs text-muted-foreground">Platform super admin</p>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{user.phone ?? 'N/A'}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                {user.roleNames.map((roleName) => (
                                  <Badge key={roleName} variant="secondary" className="whitespace-nowrap">
                                    {roleName}
                                  </Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell>
                              {user.isTenantAdmin ? (
                                <Badge variant="default" className="gap-1 whitespace-nowrap leading-none">
                                  <Shield className="h-3 w-3 shrink-0" />
                                  Full access
                                </Badge>
                              ) : (
                                <span className="text-sm text-muted-foreground">No</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant(user.status)}>{user.status}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[240px] text-sm text-muted-foreground">
                              {branchSummary(user)}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  disabled={currentUser?.id === user.id && user.status === USER_STATUS.ACTIVE}
                                  title={
                                    currentUser?.id === user.id && user.status === USER_STATUS.ACTIVE
                                      ? 'You cannot deactivate your own user'
                                      : undefined
                                  }
                                  onClick={() => void toggleStatus(user)}
                                >
                                  {user.status === USER_STATUS.ACTIVE ? 'Deactivate' : 'Activate'}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-white/80 bg-card/95">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Branches</CardTitle>
            <CardDescription>
              View branch list, update descriptions, and activate/deactivate branches.
            </CardDescription>
          </div>
          <RefreshButton loading={loading} onClick={() => void loadData()} />
        </CardHeader>
        <CardContent>
          {branches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No branches found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  {canManageBranches ? <TableHead className="text-right">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((branch) => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {branch.description?.trim() || 'No description'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={branchStatusVariant(branch.isActive)}>
                        {branch.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </TableCell>
                    {canManageBranches ? (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditBranchDialog(branch)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={togglingBranchId === branch.id}
                            onClick={() => void toggleBranchStatus(branch)}
                          >
                            {branch.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={branchDialogOpen}
        onOpenChange={(open) => {
          setBranchDialogOpen(open);
          if (!open) {
            setBranchForm(emptyBranchForm());
          }
        }}
      >
        <DialogContent preventImplicitClose>
          <DialogHeader>
            <DialogTitle>Add Branch</DialogTitle>
            <DialogDescription>
              Create a new branch for branch-scoped access and lead assignment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="branch-name">Branch Name</Label>
              <Input
                id="branch-name"
                value={branchForm.name}
                onChange={(event) => setBranchForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Downtown Lab"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch-description">Description</Label>
              <Textarea
                id="branch-description"
                value={branchForm.description}
                onChange={(event) => setBranchForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Optional branch note for your team"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void createBranch()} disabled={creatingBranch}>
              {creatingBranch ? 'Creating...' : 'Create Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editBranchDialogOpen}
        onOpenChange={(open) => {
          setEditBranchDialogOpen(open);
          if (!open) {
            setEditingBranch(null);
            setBranchForm(emptyBranchForm());
          }
        }}
      >
        <DialogContent preventImplicitClose>
          <DialogHeader>
            <DialogTitle>Edit Branch</DialogTitle>
            <DialogDescription>
              Update branch name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-branch-name">Branch Name</Label>
              <Input
                id="edit-branch-name"
                value={branchForm.name}
                onChange={(event) => setBranchForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-branch-description">Description</Label>
              <Textarea
                id="edit-branch-description"
                value={branchForm.description}
                onChange={(event) => setBranchForm((current) => ({ ...current, description: event.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void updateBranch()} disabled={updatingBranch}>
              {updatingBranch ? 'Saving...' : 'Save Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent preventImplicitClose>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Create User'}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? 'Update role assignment, branch scope, and account status.'
                : 'Create a new user with a starting role and password.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-name">Name</Label>
              <Input
                id="user-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                name="team-user-email"
                autoComplete="off"
                disabled={!!editingUser}
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-phone">Phone</Label>
              <Input
                id="user-phone"
                type="tel"
                name="team-user-phone"
                autoComplete="off"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              />
            </div>

            {!editingUser ? (
              <div className="space-y-2">
                <Label htmlFor="user-password">Password</Label>
                <PasswordInput
                  id="user-password"
                  name="team-user-password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                />
                {form.password.trim().length > 0 && form.password.trim().length < 8 ? (
                  <p className="text-xs text-red-600">Password must be at least 8 characters.</p>
                ) : null}
                <PasswordStrengthHints password={form.password} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="user-status">Status</Label>
                <Select
                  id="user-status"
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as UserStatus,
                    }))
                  }
                >
                  <option value={USER_STATUS.ACTIVE}>ACTIVE</option>
                  <option
                    value={USER_STATUS.INACTIVE}
                    disabled={!!editingUser && currentUser?.id === editingUser.id}
                  >
                    INACTIVE
                  </option>
                </Select>
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-secondary/30 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">{adminLabel} (full access)</p>
                <p className="text-sm text-muted-foreground">
                  Grants every tenant permission and unlocks all branches.
                </p>
              </div>
              <Checkbox
                checked={form.isTenantAdmin}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isTenantAdmin: event.target.checked,
                    scopeType: event.target.checked ? BRANCH_SCOPE.ALL_BRANCHES : current.scopeType,
                  }))
                }
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <Select
                id="user-role"
                disabled={form.isTenantAdmin}
                value={form.roleId}
                onChange={(event) => setForm((current) => ({ ...current, roleId: event.target.value }))}
              >
                <option value="">Select a role</option>
                {roles
                  .filter((role) => !role.isSystem || role.name === adminLabel)
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch-scope">Branch Scope</Label>
              <Select
                id="branch-scope"
                disabled={form.isTenantAdmin}
                value={form.scopeType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    scopeType: event.target.value as BranchScopeType,
                  }))
                }
              >
                <option value={BRANCH_SCOPE.ALL_BRANCHES}>All branches</option>
                <option value={BRANCH_SCOPE.SELECTED}>Selected branches</option>
              </Select>
            </div>
          </div>

          {form.scopeType === BRANCH_SCOPE.SELECTED && !form.isTenantAdmin ? (
            <div className="space-y-3 rounded-2xl border p-4">
              <div className="grid gap-2 md:grid-cols-2">
                {branches.map((branch) => (
                  <Checkbox
                    key={branch.id}
                    checked={form.branchIds.includes(branch.id)}
                    label={branch.isActive ? branch.name : `${branch.name} (inactive)`}
                    disabled={!branch.isActive && !form.branchIds.includes(branch.id)}
                    onChange={(event) => toggleBranch(branch.id, event.target.checked)}
                  />
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="default-branch">Default Branch</Label>
                <Select
                  id="default-branch"
                  value={form.defaultBranchId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      defaultBranchId: event.target.value,
                    }))
                  }
                >
                  <option value="">No default branch</option>
                  {branches
                    .filter((branch) => form.branchIds.includes(branch.id))
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.isActive ? branch.name : `${branch.name} (inactive)`}
                      </option>
                    ))}
                </Select>
              </div>
            </div>
          ) : null}

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <DialogFooter>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
