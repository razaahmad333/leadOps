import React, { useEffect, useMemo, useState } from 'react';
import type {
  CreatePlatformMembershipDto,
  CreateTenantDto,
  IndustryPreset,
  PlatformAdminOverview,
  PlatformAdminUserSummary,
  ResetPlatformUserPasswordDto,
  UpdatePlatformUserDto,
  UserStatus,
} from '@leadops/shared';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

type TenantFormState = {
  name: string;
  slug: string;
  industryPreset: IndustryPreset;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
};

type MembershipFormState = {
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  isTenantAdmin: boolean;
};

type EditUserFormState = {
  name: string;
  email: string;
  phone: string;
  status: UserStatus;
};

type PasswordFormState = {
  password: string;
  confirmPassword: string;
};

function emptyTenantForm(): TenantFormState {
  return {
    name: '',
    slug: '',
    industryPreset: 'GENERIC' as IndustryPreset,
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    adminPassword: '',
  };
}

function emptyMembershipForm(): MembershipFormState {
  return {
    tenantId: '',
    name: '',
    email: '',
    phone: '',
    password: '',
    isTenantAdmin: false,
  };
}

function buildEditUserForm(user: PlatformAdminUserSummary): EditUserFormState {
  return {
    name: user.name,
    email: user.email,
    phone: user.phone ?? '',
    status: user.status,
  };
}

function emptyPasswordForm(): PasswordFormState {
  return {
    password: '',
    confirmPassword: '',
  };
}

export function PlatformAdminPage(): React.JSX.Element {
  const { user: currentUser } = useAuth();
  const [overview, setOverview] = useState<PlatformAdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingTenant, setSavingTenant] = useState(false);
  const [savingMembership, setSavingMembership] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [tenantForm, setTenantForm] = useState<TenantFormState>(emptyTenantForm);
  const [membershipForm, setMembershipForm] = useState<MembershipFormState>(emptyMembershipForm);
  const [selectedTenantId, setSelectedTenantId] = useState('all');
  const [editingUser, setEditingUser] = useState<PlatformAdminUserSummary | null>(null);
  const [editUserForm, setEditUserForm] = useState<EditUserFormState | null>(null);
  const [passwordUser, setPasswordUser] = useState<PlatformAdminUserSummary | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyPasswordForm);

  const loadOverview = async (): Promise<void> => {
    setLoading(true);

    try {
      const response = await api.get<PlatformAdminOverview>('/v1/platform-admin');
      setOverview(response);
      setMembershipForm((current) => ({
        ...current,
        tenantId: current.tenantId || response.tenants[0]?.id || '',
      }));
      setSelectedTenantId((current) =>
        current === 'all' || response.tenants.some((tenant) => tenant.id === current) ? current : 'all',
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load platform admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  const createTenant = async (): Promise<void> => {
    setSavingTenant(true);

    try {
      const payload: CreateTenantDto = {
        ...tenantForm,
        name: tenantForm.name.trim(),
        slug: tenantForm.slug.trim().toLowerCase(),
        adminName: tenantForm.adminName.trim(),
        adminEmail: tenantForm.adminEmail.trim().toLowerCase(),
        adminPhone: tenantForm.adminPhone.trim(),
        adminPassword: tenantForm.adminPassword,
      };

      await api.post('/v1/platform-admin/tenants', payload);
      toast.success('Tenant created');
      setTenantForm(emptyTenantForm());
      await loadOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create tenant');
    } finally {
      setSavingTenant(false);
    }
  };

  const createMembership = async (): Promise<void> => {
    setSavingMembership(true);

    try {
      const payload: CreatePlatformMembershipDto = {
        tenantId: membershipForm.tenantId,
        name: membershipForm.name.trim(),
        email: membershipForm.email.trim().toLowerCase(),
        phone: membershipForm.phone.trim(),
        password: membershipForm.password.trim() || undefined,
        isTenantAdmin: membershipForm.isTenantAdmin,
      };

      await api.post('/v1/platform-admin/memberships', payload);
      toast.success('Membership created');
      setMembershipForm((current) => ({
        ...emptyMembershipForm(),
        tenantId: current.tenantId,
      }));
      await loadOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create membership');
    } finally {
      setSavingMembership(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const rows = [...(overview?.users ?? [])];
    rows.sort((left, right) => {
      const byTenant = left.tenantName.localeCompare(right.tenantName);
      if (byTenant !== 0) {
        return byTenant;
      }

      return left.name.localeCompare(right.name);
    });

    if (selectedTenantId === 'all') {
      return rows;
    }

    return rows.filter((row) => row.tenantId === selectedTenantId);
  }, [overview?.users, selectedTenantId]);

  const openEditDialog = (user: PlatformAdminUserSummary): void => {
    setEditingUser(user);
    setEditUserForm(buildEditUserForm(user));
  };

  const closeEditDialog = (): void => {
    setEditingUser(null);
    setEditUserForm(null);
  };

  const saveUserInfo = async (): Promise<void> => {
    if (!editingUser || !editUserForm) {
      return;
    }

    if (editingUser.userId === currentUser?.id && editUserForm.status === 'INACTIVE') {
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

      await api.patch(`/v1/platform-admin/users/${editingUser.userId}`, payload);
      toast.success('User info updated');
      closeEditDialog();
      await loadOverview();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update user info');
    } finally {
      setSavingEdit(false);
    }
  };

  const openPasswordDialog = (user: PlatformAdminUserSummary): void => {
    setPasswordUser(user);
    setPasswordForm(emptyPasswordForm());
  };

  const closePasswordDialog = (): void => {
    setPasswordUser(null);
    setPasswordForm(emptyPasswordForm());
  };

  const savePassword = async (): Promise<void> => {
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
      await api.post(`/v1/platform-admin/users/${passwordUser.userId}/reset-password`, payload);
      toast.success('Password updated');
      closePasswordDialog();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[2rem] border-white/70 bg-card/90">
        <CardHeader>
          <CardTitle>Platform Admin</CardTitle>
          <CardDescription>
            Create tenants, provision initial tenant admins, and grant account access without touching the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/70 bg-secondary/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tenants</p>
            <p className="mt-2 text-2xl font-semibold">{overview?.tenants.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-secondary/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Accounts</p>
            <p className="mt-2 text-2xl font-semibold">{overview?.accounts.length ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-white/70 bg-secondary/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Memberships</p>
            <p className="mt-2 text-2xl font-semibold">
              {overview?.accounts.reduce((sum, account) => sum + account.membershipCount, 0) ?? 0}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[2rem] border-white/70 bg-card/90">
          <CardHeader>
            <CardTitle>Onboard Tenant</CardTitle>
            <CardDescription>Create a tenant, seed its defaults, and attach the first tenant admin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tenant-name">Tenant Name</Label>
                <Input
                  id="tenant-name"
                  value={tenantForm.name}
                  onChange={(event) => setTenantForm((current) => ({ ...current, name: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-slug">Tenant Slug</Label>
                <Input
                  id="tenant-slug"
                  value={tenantForm.slug}
                  onChange={(event) => setTenantForm((current) => ({ ...current, slug: event.target.value }))}
                  placeholder="new-clinic"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tenant-preset">Industry Preset</Label>
              <Select
                id="tenant-preset"
                value={tenantForm.industryPreset}
                onChange={(event) =>
                  setTenantForm((current) => ({
                    ...current,
                    industryPreset: event.target.value as IndustryPreset,
                  }))
                }
              >
                <option value="GENERIC">Generic</option>
                <option value="DIAGNOSTICS_LAB">Diagnostics Lab</option>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tenant-admin-name">Admin Name</Label>
                <Input
                  id="tenant-admin-name"
                  value={tenantForm.adminName}
                  onChange={(event) =>
                    setTenantForm((current) => ({ ...current, adminName: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-admin-email">Admin Email</Label>
                <Input
                  id="tenant-admin-email"
                  type="email"
                  value={tenantForm.adminEmail}
                  onChange={(event) =>
                    setTenantForm((current) => ({ ...current, adminEmail: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="tenant-admin-phone">Admin Phone</Label>
                <Input
                  id="tenant-admin-phone"
                  value={tenantForm.adminPhone}
                  onChange={(event) =>
                    setTenantForm((current) => ({ ...current, adminPhone: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenant-admin-password">Admin Password</Label>
                <Input
                  id="tenant-admin-password"
                  type="password"
                  value={tenantForm.adminPassword}
                  onChange={(event) =>
                    setTenantForm((current) => ({ ...current, adminPassword: event.target.value }))
                  }
                />
              </div>
            </div>

            <Button className="w-full" disabled={savingTenant} onClick={() => void createTenant()}>
              {savingTenant ? 'Creating tenant...' : 'Create Tenant'}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-white/70 bg-card/90">
          <CardHeader>
            <CardTitle>Create Account Access</CardTitle>
            <CardDescription>
              Add an existing account to a tenant or create a brand-new account and membership in one step.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="membership-tenant">Tenant</Label>
              <Select
                id="membership-tenant"
                value={membershipForm.tenantId}
                onChange={(event) =>
                  setMembershipForm((current) => ({ ...current, tenantId: event.target.value }))
                }
              >
                <option value="">Select a tenant</option>
                {(overview?.tenants ?? []).map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="membership-name">User Name</Label>
                <Input
                  id="membership-name"
                  value={membershipForm.name}
                  onChange={(event) =>
                    setMembershipForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="membership-email">Email</Label>
                <Input
                  id="membership-email"
                  type="email"
                  value={membershipForm.email}
                  onChange={(event) =>
                    setMembershipForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="membership-phone">Phone</Label>
                <Input
                  id="membership-phone"
                  value={membershipForm.phone}
                  onChange={(event) =>
                    setMembershipForm((current) => ({ ...current, phone: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="membership-password">Password (new accounts only)</Label>
                <Input
                  id="membership-password"
                  type="password"
                  value={membershipForm.password}
                  onChange={(event) =>
                    setMembershipForm((current) => ({ ...current, password: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/70 bg-secondary/30 p-4">
              <Checkbox
                checked={membershipForm.isTenantAdmin}
                label="Tenant Admin"
                onChange={(event) =>
                  setMembershipForm((current) => ({
                    ...current,
                    isTenantAdmin: event.target.checked,
                  }))
                }
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Tenant admins get full tenant access and all branches by default.
              </p>
            </div>

            <Button
              className="w-full"
              disabled={savingMembership || !membershipForm.tenantId}
              onClick={() => void createMembership()}
            >
              {savingMembership ? 'Creating access...' : 'Create Account Access'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="rounded-[2rem] border-white/70 bg-card/90">
          <CardHeader>
            <CardTitle>Tenants</CardTitle>
            <CardDescription>All tenants currently provisioned on the platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(overview?.tenants ?? []).map((tenant) => (
              <div key={tenant.id} className="rounded-2xl border border-white/70 bg-background/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{tenant.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{tenant.slug}</p>
                  </div>
                  <Badge variant="outline">{tenant.industryPreset === 'DIAGNOSTICS_LAB' ? 'Lab' : 'Generic'}</Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{tenant.userCount} users</span>
                  <span>{new Date(tenant.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-white/70 bg-card/90">
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>Users By Tenant</CardTitle>
                <CardDescription>
                  Use this table to filter users per tenant and update profile info or passwords as platform admin.
                </CardDescription>
              </div>
              <div className="w-full max-w-xs space-y-2">
                <Label htmlFor="tenant-filter">Tenant Filter</Label>
                <Select
                  id="tenant-filter"
                  value={selectedTenantId}
                  onChange={(event) => setSelectedTenantId(event.target.value)}
                >
                  <option value="all">All tenants</option>
                  {(overview?.tenants ?? []).map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table className="min-w-[920px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No users found for this tenant filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.userId}>
                      <TableCell>
                        <p className="font-medium">{user.tenantName}</p>
                        <p className="text-xs text-muted-foreground">{user.tenantSlug}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{user.name}</p>
                        {user.isSuperAdmin ? (
                          <Badge className="mt-1" variant="outline">
                            Super Admin
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{user.email}</p>
                        <p className="text-xs text-muted-foreground">{user.phone || 'No phone'}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {user.isTenantAdmin ? 'Tenant Admin' : user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={user.status === 'ACTIVE' ? 'secondary' : 'outline'}>
                            User: {user.status}
                          </Badge>
                          <Badge variant={user.accountStatus === 'ACTIVE' ? 'secondary' : 'outline'}>
                            Account: {user.accountStatus}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEditDialog(user)}>
                            Edit Info
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => openPasswordDialog(user)}>
                            Reset Password
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={editingUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeEditDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User Info</DialogTitle>
            <DialogDescription>
              Update this membership profile. Email and phone changes update the linked account across all its
              tenant memberships.
            </DialogDescription>
          </DialogHeader>

          {editUserForm && editingUser ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-user-name">Name</Label>
                <Input
                  id="edit-user-name"
                  value={editUserForm.name}
                  onChange={(event) =>
                    setEditUserForm((current) =>
                      current ? { ...current, name: event.target.value } : current,
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-user-email">Email</Label>
                <Input
                  id="edit-user-email"
                  type="email"
                  value={editUserForm.email}
                  onChange={(event) =>
                    setEditUserForm((current) =>
                      current ? { ...current, email: event.target.value } : current,
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-user-phone">Phone</Label>
                <Input
                  id="edit-user-phone"
                  value={editUserForm.phone}
                  onChange={(event) =>
                    setEditUserForm((current) =>
                      current ? { ...current, phone: event.target.value } : current,
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-user-status">User Status</Label>
                <Select
                  id="edit-user-status"
                  value={editUserForm.status}
                  onChange={(event) =>
                    setEditUserForm((current) =>
                      current ? { ...current, status: event.target.value as UserStatus } : current,
                    )
                  }
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option
                    value="INACTIVE"
                    disabled={!!editingUser && editingUser.userId === currentUser?.id}
                  >
                    INACTIVE
                  </option>
                </Select>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeEditDialog}>
                  Cancel
                </Button>
                <Button disabled={savingEdit} onClick={() => void saveUserInfo()}>
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordUser !== null}
        onOpenChange={(open) => {
          if (!open) {
            closePasswordDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new login password for {passwordUser?.email}. This applies to all tenant memberships under that
              account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">New Password</Label>
              <Input
                id="reset-password"
                type="password"
                value={passwordForm.password}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-password-confirm">Confirm Password</Label>
              <Input
                id="reset-password-confirm"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closePasswordDialog}>
                Cancel
              </Button>
              <Button disabled={savingPassword} onClick={() => void savePassword()}>
                {savingPassword ? 'Saving...' : 'Update Password'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
