import React, { useEffect, useMemo, useState } from 'react';
import type {
  CreateRoleDto,
  PermissionGroup,
  RoleSummary,
  UpdateRoleDto,
} from '@leadops/shared';
import {
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
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
import { Skeleton } from '../../components/ui/skeleton';

interface RoleFormState {
  name: string;
  description: string;
  permissionKeys: string[];
}

function emptyForm(): RoleFormState {
  return {
    name: '',
    description: '',
    permissionKeys: [],
  };
}

export function RolesPage(): React.JSX.Element {
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleSummary | null>(null);
  const [form, setForm] = useState<RoleFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = async (): Promise<void> => {
    setLoading(true);

    try {
      const [nextRoles, nextGroups] = await Promise.all([
        api.get<RoleSummary[]>('/v1/roles'),
        api.get<PermissionGroup[]>('/v1/permissions'),
      ]);

      setRoles(nextRoles);
      setGroups(nextGroups);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const filteredRoles = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return roles;
    }

    return roles.filter((role) => {
      return `${role.name} ${role.description ?? ''}`.toLowerCase().includes(term);
    });
  }, [query, roles]);

  const openCreate = (): void => {
    setEditingRole(null);
    setForm(emptyForm());
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (role: RoleSummary): void => {
    if (role.isSystem) {
      return;
    }

    setEditingRole(role);
    setForm({
      name: role.name,
      description: role.description ?? '',
      permissionKeys: role.permissionKeys,
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const togglePermission = (permissionKey: string, checked: boolean): void => {
    setForm((current) => ({
      ...current,
      permissionKeys: checked
        ? [...current.permissionKeys, permissionKey]
        : current.permissionKeys.filter((key) => key !== permissionKey),
    }));
  };

  const toggleGroup = (group: PermissionGroup): void => {
    const groupKeys = group.permissions.map((permission) => permission.key);
    const hasAll = groupKeys.every((key) => form.permissionKeys.includes(key));

    setForm((current) => ({
      ...current,
      permissionKeys: hasAll
        ? current.permissionKeys.filter((key) => !groupKeys.includes(key))
        : [...new Set([...current.permissionKeys, ...groupKeys])],
    }));
  };

  const submit = async (): Promise<void> => {
    if (form.name.trim().length < 2) {
      setFormError('Role name must be at least 2 characters.');
      return;
    }

    setFormError(null);
    setSaving(true);

    try {
      if (editingRole) {
        const payload: UpdateRoleDto = {
          name: form.name.trim(),
          description: form.description.trim() || null,
          permissionKeys: form.permissionKeys,
        };
        await api.patch<RoleSummary>(`/v1/roles/${editingRole.id}`, payload);
        toast.success('Role updated');
      } else {
        const payload: CreateRoleDto = {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          permissionKeys: form.permissionKeys,
        };
        await api.post<RoleSummary>('/v1/roles', payload);
        toast.success('Role created');
      }

      setDialogOpen(false);
      setForm(emptyForm());
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async (role: RoleSummary): Promise<void> => {
    if (role.isSystem) {
      return;
    }

    if (!window.confirm(`Delete role "${role.name}"?`)) {
      return;
    }

    try {
      await api.delete<void>(`/v1/roles/${role.id}`);
      toast.success('Role deleted');
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete role');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2 pt-2 sm:pt-3">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Access Design</p>
          <h1 className="text-2xl font-bold">Roles</h1>
          <p className="text-sm text-muted-foreground">
            Build permission bundles once, then assign them across the tenant.
          </p>
        </div>
        <Button data-tour-id="roles-create-role" onClick={openCreate} className="gap-2 self-start w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Create Role
        </Button>
      </div>

      <Card className="rounded-3xl border-white/80 bg-card/95">
        <CardHeader className="gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Role Library</CardTitle>
            <CardDescription>System templates stay locked. Custom roles are fully editable.</CardDescription>
          </div>
          <Input
            className="w-full lg:max-w-xs"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search roles"
          />
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-32 w-full" />
              ))}
            </div>
          ) : filteredRoles.length === 0 ? (
            <Card className="border-dashed bg-background/70">
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                No roles match this filter.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {filteredRoles.map((role) => (
                <Card key={role.id} className="rounded-3xl border-white/70 bg-background/60">
                  <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{role.name}</CardTitle>
                        {role.isSystem ? (
                          <Badge variant="secondary" className="gap-1">
                            <Lock className="h-3 w-3" />
                            System
                          </Badge>
                        ) : null}
                      </div>
                      <CardDescription className="mt-1">
                        {role.description || 'No description provided.'}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(role)}
                        disabled={role.isSystem}
                        title={role.isSystem ? 'System roles are locked' : 'Edit role'}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void deleteRole(role)}
                        disabled={role.isSystem}
                        title={role.isSystem ? 'System roles are locked' : 'Delete role'}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{role.permissionKeys.length} permissions</Badge>
                      <Badge variant="outline">{role.userCount} assigned users</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {role.permissionKeys.slice(0, 6).map((key) => (
                        <Badge key={key} variant="secondary">
                          {key}
                        </Badge>
                      ))}
                      {role.permissionKeys.length > 6 ? (
                        <Badge variant="outline">+{role.permissionKeys.length - 6} more</Badge>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
            <DialogDescription>
              Group permissions into a clean bundle for repeated assignment.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-4">
            {groups.map((group) => {
              const selectedCount = group.permissions.filter((permission) =>
                form.permissionKeys.includes(permission.key),
              ).length;

              return (
                <div key={group.group} className="rounded-2xl border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">{group.group}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedCount} / {group.permissions.length} selected
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => toggleGroup(group)}>
                      <ShieldCheck className="h-4 w-4" />
                      {selectedCount === group.permissions.length ? 'Clear Group' : 'Select Group'}
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {group.permissions.map((permission) => (
                      <div key={permission.key} className="rounded-xl border bg-background/70 p-3">
                        <Checkbox
                          checked={form.permissionKeys.includes(permission.key)}
                          onChange={(event) => togglePermission(permission.key, event.target.checked)}
                          label={permission.key}
                        />
                        <p className="mt-2 text-xs text-muted-foreground">{permission.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void submit()} disabled={saving}>
              {saving ? 'Saving...' : editingRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
