import React from 'react';
import type { IndustryPreset } from '@leadops/shared';
import { Button } from '../../../../components/ui/button';
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
import type { TenantFormState } from '../../platform-admin.types';

type CreateTenantDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantForm: TenantFormState;
  setTenantForm: React.Dispatch<React.SetStateAction<TenantFormState>>;
  savingTenant: boolean;
  onCreate: () => void;
};

export function CreateTenantDialog(props: CreateTenantDialogProps): React.JSX.Element {
  const { open, onOpenChange, tenantForm, setTenantForm, savingTenant, onCreate } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Tenant</DialogTitle>
          <DialogDescription>Create a tenant, seed defaults, and attach the initial tenant admin.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
                name="tenant-admin-email"
                autoComplete="off"
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
                type="tel"
                name="tenant-admin-phone"
                autoComplete="off"
                value={tenantForm.adminPhone}
                onChange={(event) =>
                  setTenantForm((current) => ({ ...current, adminPhone: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-admin-password">Admin Password</Label>
              <PasswordInput
                id="tenant-admin-password"
                name="tenant-admin-password"
                autoComplete="new-password"
                value={tenantForm.adminPassword}
                onChange={(event) =>
                  setTenantForm((current) => ({ ...current, adminPassword: event.target.value }))
                }
              />
              {tenantForm.adminPassword.trim().length > 0 && tenantForm.adminPassword.trim().length < 8 ? (
                <p className="text-xs text-red-600">Password must be at least 8 characters.</p>
              ) : null}
              <PasswordStrengthHints password={tenantForm.adminPassword} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={savingTenant} onClick={onCreate}>
              {savingTenant ? 'Creating...' : 'Create Tenant'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
