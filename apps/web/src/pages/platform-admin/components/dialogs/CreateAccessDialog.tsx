import React from 'react';
import type { PlatformTenantOption } from '@leadops/shared';
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
import { PasswordInput } from '../../../../components/ui/password-input';
import { PasswordStrengthHints } from '../../../../components/ui/password-strength-hints';
import { Select } from '../../../../components/ui/select';
import type { MembershipFormState } from '../../platform-admin.types';

type CreateAccessDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantOptionQuery: string;
  setTenantOptionQuery: React.Dispatch<React.SetStateAction<string>>;
  tenantOptions: PlatformTenantOption[];
  tenantOptionsLoading: boolean;
  membershipForm: MembershipFormState;
  setMembershipForm: React.Dispatch<React.SetStateAction<MembershipFormState>>;
  savingMembership: boolean;
  onCreate: () => void;
};

export function CreateAccessDialog(props: CreateAccessDialogProps): React.JSX.Element {
  const {
    open,
    onOpenChange,
    tenantOptionQuery,
    setTenantOptionQuery,
    tenantOptions,
    tenantOptionsLoading,
    membershipForm,
    setMembershipForm,
    savingMembership,
    onCreate,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" preventImplicitClose>
        <DialogHeader>
          <DialogTitle>Create Account Access</DialogTitle>
          <DialogDescription>
            Add an account to a tenant, or create a new account and membership in one step.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenant-option-search">Search Tenant</Label>
            <Input
              id="tenant-option-search"
              placeholder="Type tenant name or slug"
              value={tenantOptionQuery}
              onChange={(event) => setTenantOptionQuery(event.target.value)}
            />
          </div>

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
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name} ({tenant.slug})
                </option>
              ))}
            </Select>
            {tenantOptionsLoading ? (
              <p className="text-xs text-muted-foreground">Loading tenant options...</p>
            ) : null}
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
                name="membership-email"
                autoComplete="off"
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
                type="tel"
                name="membership-phone"
                autoComplete="off"
                value={membershipForm.phone}
                onChange={(event) =>
                  setMembershipForm((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="membership-password">Password (new accounts only)</Label>
              <PasswordInput
                id="membership-password"
                name="membership-password"
                autoComplete="new-password"
                value={membershipForm.password}
                onChange={(event) =>
                  setMembershipForm((current) => ({ ...current, password: event.target.value }))
                }
              />
              {membershipForm.password.trim().length > 0 && membershipForm.password.trim().length < 8 ? (
                <p className="text-xs text-red-600">Password must be at least 8 characters.</p>
              ) : null}
              {membershipForm.password.trim().length > 0 ? (
                <PasswordStrengthHints password={membershipForm.password} />
              ) : null}
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
              Tenant admins receive full tenant access and all branches by default.
            </p>
          </div>

          <DialogFooter>
            <Button disabled={savingMembership || !membershipForm.tenantId} onClick={onCreate}>
              {savingMembership ? 'Creating...' : 'Create Access'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
