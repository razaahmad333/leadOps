import React from 'react';
import type { PermissionGroup, PlatformTenantRole } from '@leadops/shared';
import { Button } from '../../../../components/ui/button';
import { Checkbox } from '../../../../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Skeleton } from '../../../../components/ui/skeleton';
import type { RoleFormState } from '../../platform-admin.types';

type RoleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRole: PlatformTenantRole | null;
  roleForm: RoleFormState;
  setRoleForm: React.Dispatch<React.SetStateAction<RoleFormState>>;
  roleFormError: string | null;
  savingRole: boolean;
  permissionGroupsLoading: boolean;
  permissionGroups: PermissionGroup[];
  onTogglePermission: (permissionKey: string, checked: boolean) => void;
  onToggleGroup: (group: PermissionGroup) => void;
  onClose: () => void;
  onSave: () => void;
};

export function RoleDialog(props: RoleDialogProps): React.JSX.Element {
  const {
    open,
    onOpenChange,
    editingRole,
    roleForm,
    setRoleForm,
    roleFormError,
    savingRole,
    permissionGroupsLoading,
    permissionGroups,
    onTogglePermission,
    onToggleGroup,
    onClose,
    onSave,
  } = props;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-5xl" preventImplicitClose>
        <DialogHeader>
          <DialogTitle>{editingRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
          <DialogDescription>
            Build permission bundles for the selected tenant.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="platform-role-name">Role Name</Label>
            <Input
              id="platform-role-name"
              value={roleForm.name}
              onChange={(event) =>
                setRoleForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="platform-role-description">Description</Label>
            <Input
              id="platform-role-description"
              value={roleForm.description}
              onChange={(event) =>
                setRoleForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </div>
        </div>

        {permissionGroupsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-4">
            {permissionGroups.map((group) => {
              const selectedCount = group.permissions.filter((permission) =>
                roleForm.permissionKeys.includes(permission.key),
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
                    <Button variant="outline" size="sm" onClick={() => onToggleGroup(group)}>
                      {selectedCount === group.permissions.length ? 'Clear Group' : 'Select Group'}
                    </Button>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {group.permissions.map((permission) => (
                      <div key={permission.key} className="rounded-xl border bg-background/70 p-3">
                        <Checkbox
                          checked={roleForm.permissionKeys.includes(permission.key)}
                          onChange={(event) => onTogglePermission(permission.key, event.target.checked)}
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
        )}

        {roleFormError ? <p className="text-sm text-destructive">{roleFormError}</p> : null}

        <DialogFooter>
          <Button onClick={onSave} disabled={savingRole || permissionGroupsLoading}>
            {savingRole ? 'Saving...' : editingRole ? 'Save Changes' : 'Create Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
