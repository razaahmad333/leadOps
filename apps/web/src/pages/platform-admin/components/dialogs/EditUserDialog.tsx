import React from 'react';
import type { BranchScopeType, PlatformTenantDetails, UserStatus } from '@leadops/shared';
import { BRANCH_SCOPE } from '../../platform-admin.constants';
import type { EditUserFormState, EditUserTarget } from '../../platform-admin.types';
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
import { Select } from '../../../../components/ui/select';

type EditUserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser: EditUserTarget | null;
  editUserForm: EditUserFormState | null;
  setEditUserForm: React.Dispatch<React.SetStateAction<EditUserFormState | null>>;
  savingEdit: boolean;
  currentUserId?: string;
  availableRoles: PlatformTenantDetails['availableRoles'];
  tenantBranches: PlatformTenantDetails['branches'];
  branchById: Map<string, PlatformTenantDetails['branches'][number]>;
  onClose: () => void;
  onSave: () => void;
};

export function EditUserDialog(props: EditUserDialogProps): React.JSX.Element {
  const {
    open,
    onOpenChange,
    editingUser,
    editUserForm,
    setEditUserForm,
    savingEdit,
    currentUserId,
    availableRoles,
    tenantBranches,
    branchById,
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
      <DialogContent preventImplicitClose>
        <DialogHeader>
          <DialogTitle>Edit User Info</DialogTitle>
          <DialogDescription>
            Email and phone updates apply to the linked account across all its tenant memberships.
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
                type="tel"
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
                <option value="INACTIVE" disabled={editingUser.userId === currentUserId}>
                  INACTIVE
                </option>
              </Select>
            </div>

            {editingUser.isSuperAdmin ? (
              <div className="rounded-2xl border border-white/70 bg-secondary/30 p-3 text-sm text-muted-foreground">
                SUPER_ADMIN users always retain full-tenant access.
              </div>
            ) : (
              <div className="rounded-2xl border border-white/70 bg-secondary/30 p-4">
                <Checkbox
                  checked={editUserForm.isTenantAdmin}
                  label="Tenant Admin"
                  onChange={(event) =>
                    setEditUserForm((current) => {
                      if (!current) {
                        return current;
                      }

                      if (event.target.checked) {
                        return {
                          ...current,
                          isTenantAdmin: true,
                          scopeType: BRANCH_SCOPE.ALL,
                          branchIds: [],
                          defaultBranchId: '',
                        };
                      }

                      return {
                        ...current,
                        isTenantAdmin: false,
                      };
                    })
                  }
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Tenant admins get all-branch access. You can still assign additional roles below.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Roles</Label>
              <div className="space-y-2 rounded-2xl border border-white/70 p-3">
                {availableRoles.length ? (
                  availableRoles.map((role) => {
                    const checked = editUserForm.roleIds.includes(role.id);
                    return (
                      <Checkbox
                        key={role.id}
                        checked={checked}
                        label={role.isSystem ? `${role.name} (system)` : role.name}
                        onChange={(event) =>
                          setEditUserForm((current) => {
                            if (!current) {
                              return current;
                            }

                            const nextRoleIds = event.target.checked
                              ? [...current.roleIds, role.id]
                              : current.roleIds.filter((id) => id !== role.id);

                            return {
                              ...current,
                              roleIds: [...new Set(nextRoleIds)],
                            };
                          })
                        }
                      />
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No roles available for this tenant.</p>
                )}
              </div>
            </div>

            {editUserForm.isTenantAdmin || editingUser.isSuperAdmin ? (
              <div className="rounded-2xl border border-white/70 bg-secondary/30 p-3 text-sm text-muted-foreground">
                This user has full-tenant access. Branch scope stays All branches.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-user-branch-scope">Branch Scope</Label>
                  <Select
                    id="edit-user-branch-scope"
                    value={editUserForm.scopeType}
                    onChange={(event) =>
                      setEditUserForm((current) => {
                        if (!current) {
                          return current;
                        }

                        const nextScope = event.target.value as BranchScopeType;
                        if (nextScope === BRANCH_SCOPE.ALL) {
                          return {
                            ...current,
                            scopeType: BRANCH_SCOPE.ALL,
                            branchIds: [],
                            defaultBranchId: '',
                          };
                        }

                        const activeBranchIds = tenantBranches
                          .filter((branch) => branch.isActive)
                          .map((branch) => branch.id);
                        const nextBranchIds = current.branchIds.length > 0
                          ? current.branchIds
                          : (activeBranchIds[0] ? [activeBranchIds[0]] : []);
                        const nextDefault = nextBranchIds.includes(current.defaultBranchId)
                          ? current.defaultBranchId
                          : '';

                        return {
                          ...current,
                          scopeType: BRANCH_SCOPE.SELECTED,
                          branchIds: nextBranchIds,
                          defaultBranchId: nextDefault,
                        };
                      })
                    }
                  >
                    <option value={BRANCH_SCOPE.ALL}>All branches</option>
                    <option value={BRANCH_SCOPE.SELECTED}>Selected branches</option>
                  </Select>
                </div>

                {editUserForm.scopeType === BRANCH_SCOPE.SELECTED ? (
                  <>
                    <div className="space-y-2">
                      <Label>Selected Branches</Label>
                      <div className="space-y-2 rounded-2xl border border-white/70 p-3">
                        {tenantBranches.map((branch) => {
                          const checked = editUserForm.branchIds.includes(branch.id);
                          return (
                            <Checkbox
                              key={branch.id}
                              checked={checked}
                              label={branch.isActive ? branch.name : `${branch.name} (inactive)`}
                              disabled={!branch.isActive && !checked}
                              onChange={(event) =>
                                setEditUserForm((current) => {
                                  if (!current || current.scopeType !== BRANCH_SCOPE.SELECTED) {
                                    return current;
                                  }

                                  const nextBranchIds = event.target.checked
                                    ? [...current.branchIds, branch.id]
                                    : current.branchIds.filter((id) => id !== branch.id);

                                  return {
                                    ...current,
                                    branchIds: [...new Set(nextBranchIds)],
                                    defaultBranchId: nextBranchIds.includes(current.defaultBranchId)
                                      ? current.defaultBranchId
                                      : '',
                                  };
                                })
                              }
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-user-default-branch">Default Branch</Label>
                      <Select
                        id="edit-user-default-branch"
                        value={editUserForm.defaultBranchId}
                        onChange={(event) =>
                          setEditUserForm((current) =>
                            current ? { ...current, defaultBranchId: event.target.value } : current,
                          )
                        }
                      >
                        <option value="">No default branch</option>
                        {editUserForm.branchIds.map((branchId) => {
                          const branch = branchById.get(branchId);
                          if (!branch) {
                            return null;
                          }

                          return (
                            <option key={branch.id} value={branch.id}>
                              {branch.isActive ? branch.name : `${branch.name} (inactive)`}
                            </option>
                          );
                        })}
                      </Select>
                    </div>
                  </>
                ) : null}
              </>
            )}

            <DialogFooter>
              <Button disabled={savingEdit} onClick={onSave}>
                {savingEdit ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
