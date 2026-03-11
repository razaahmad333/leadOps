import React, { useEffect, useMemo, useState } from 'react';
import type {
  CustomEnquiryField,
  TenantIntakeConfig,
  TestPackage,
  UpdateTenantIntakeConfigDto,
} from '@leadops/shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
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
import { Select } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import { Textarea } from '../../components/ui/textarea';

type FieldType = CustomEnquiryField['type'];

interface FieldFormState {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder: string;
  optionsText: string;
}

interface TestPackageFormState {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

const FIELD_TYPES: FieldType[] = ['text', 'email', 'phone', 'select', 'boolean', 'datetime', 'textarea'];

function emptyFieldForm(): FieldFormState {
  return {
    key: '',
    label: '',
    type: 'text',
    required: false,
    placeholder: '',
    optionsText: '',
  };
}

function emptyTestPackageForm(): TestPackageFormState {
  return {
    id: '',
    name: '',
    description: '',
    enabled: true,
  };
}

function parseOptions(value: string): string[] {
  return value
    .split(',')
    .map((option) => option.trim())
    .filter((option, index, list) => option.length > 0 && list.indexOf(option) === index);
}

function toOptionsText(options: string[] | undefined): string {
  return (options ?? []).join(', ');
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildFieldForm(field: CustomEnquiryField): FieldFormState {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    placeholder: field.placeholder ?? '',
    optionsText: toOptionsText(field.options),
  };
}

function buildPackageForm(testPackage: TestPackage): TestPackageFormState {
  return {
    id: testPackage.id,
    name: testPackage.name,
    description: testPackage.description,
    enabled: testPackage.enabled,
  };
}

export function IntakeConfigPage(): React.JSX.Element {
  const { user } = useAuth();
  const { refreshTenant } = useTenant();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initialConfig, setInitialConfig] = useState<TenantIntakeConfig | null>(null);
  const [customFields, setCustomFields] = useState<CustomEnquiryField[]>([]);
  const [testPackages, setTestPackages] = useState<TestPackage[]>([]);

  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [fieldForm, setFieldForm] = useState<FieldFormState>(emptyFieldForm);

  const [packageDialogOpen, setPackageDialogOpen] = useState(false);
  const [editingPackageIndex, setEditingPackageIndex] = useState<number | null>(null);
  const [packageForm, setPackageForm] = useState<TestPackageFormState>(emptyTestPackageForm);

  const isTenantAdmin = user?.isTenantAdmin || user?.isSuperAdmin;

  const load = async (): Promise<void> => {
    setLoading(true);

    try {
      const response = await api.get<TenantIntakeConfig>('/v1/settings/intake-config');
      setInitialConfig(response);
      setCustomFields(response.customEnquiryFields);
      setTestPackages(response.testPackages);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load enquiry configuration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isTenantAdmin) {
      setLoading(false);
      return;
    }

    void load();
  }, [isTenantAdmin]);

  const hasChanges = useMemo(() => {
    if (!initialConfig) {
      return false;
    }

    return (
      JSON.stringify(initialConfig.customEnquiryFields) !== JSON.stringify(customFields)
      || JSON.stringify(initialConfig.testPackages) !== JSON.stringify(testPackages)
    );
  }, [customFields, initialConfig, testPackages]);

  const openCreateField = (): void => {
    setEditingFieldIndex(null);
    setFieldForm(emptyFieldForm());
    setFieldDialogOpen(true);
  };

  const openEditField = (index: number): void => {
    setEditingFieldIndex(index);
    setFieldForm(buildFieldForm(customFields[index]));
    setFieldDialogOpen(true);
  };

  const saveField = (): void => {
    const key = fieldForm.key.trim();
    const label = fieldForm.label.trim();

    if (!/^[a-z][a-zA-Z0-9_]*$/.test(key)) {
      toast.error('Field key must start with lowercase letter and use letters, numbers, underscore');
      return;
    }

    if (label.length < 2) {
      toast.error('Field label must be at least 2 characters');
      return;
    }

    const nextField: CustomEnquiryField = {
      key,
      label,
      type: fieldForm.type,
      required: fieldForm.required,
      placeholder: fieldForm.placeholder.trim() || undefined,
      options: fieldForm.type === 'select' ? parseOptions(fieldForm.optionsText) : undefined,
      section: 'intake',
    };

    if (nextField.type === 'select' && (nextField.options ?? []).length === 0) {
      toast.error('Select fields need at least one option');
      return;
    }

    const duplicateKey = customFields.some(
      (field, index) => field.key === nextField.key && index !== editingFieldIndex,
    );

    if (duplicateKey) {
      toast.error('Field key already exists');
      return;
    }

    setCustomFields((current) => {
      if (editingFieldIndex === null) {
        return [...current, nextField];
      }

      return current.map((field, index) => (index === editingFieldIndex ? nextField : field));
    });

    setFieldDialogOpen(false);
    setFieldForm(emptyFieldForm());
    setEditingFieldIndex(null);
  };

  const removeField = (index: number): void => {
    setCustomFields((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const openCreatePackage = (): void => {
    setEditingPackageIndex(null);
    setPackageForm(emptyTestPackageForm());
    setPackageDialogOpen(true);
  };

  const openEditPackage = (index: number): void => {
    setEditingPackageIndex(index);
    setPackageForm(buildPackageForm(testPackages[index]));
    setPackageDialogOpen(true);
  };

  const savePackage = (): void => {
    const name = packageForm.name.trim();
    if (name.length < 2) {
      toast.error('Test package name must be at least 2 characters');
      return;
    }

    const id = packageForm.id.trim() || slugify(name);
    if (!id) {
      toast.error('Unable to generate package id');
      return;
    }

    const duplicateId = testPackages.some(
      (pkg, index) => pkg.id === id && index !== editingPackageIndex,
    );

    if (duplicateId) {
      toast.error('Another package already uses this id/name');
      return;
    }

    const nextPackage: TestPackage = {
      id,
      name,
      description: packageForm.description.trim(),
      enabled: packageForm.enabled,
    };

    setTestPackages((current) => {
      if (editingPackageIndex === null) {
        return [...current, nextPackage];
      }

      return current.map((pkg, index) => (index === editingPackageIndex ? nextPackage : pkg));
    });

    setPackageDialogOpen(false);
    setPackageForm(emptyTestPackageForm());
    setEditingPackageIndex(null);
  };

  const removePackage = (index: number): void => {
    setTestPackages((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const togglePackage = (index: number): void => {
    setTestPackages((current) =>
      current.map((pkg, currentIndex) =>
        currentIndex === index ? { ...pkg, enabled: !pkg.enabled } : pkg,
      ),
    );
  };

  const saveAll = async (): Promise<void> => {
    setSaving(true);

    try {
      const payload: UpdateTenantIntakeConfigDto = {
        customEnquiryFields: customFields,
        testPackages,
      };

      const response = await api.patch<TenantIntakeConfig>('/v1/settings/intake-config', payload);
      setInitialConfig(response);
      setCustomFields(response.customEnquiryFields);
      setTestPackages(response.testPackages);
      await refreshTenant();
      toast.success('Enquiry configuration updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update enquiry configuration');
    } finally {
      setSaving(false);
    }
  };

  if (!isTenantAdmin) {
    return (
      <Card className="rounded-3xl border-white/80 bg-card/95">
        <CardHeader>
          <CardTitle>Enquiry Builder</CardTitle>
          <CardDescription>Only tenant admins can manage enquiry fields and test packages.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <Skeleton className="h-56 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2 pt-2 sm:pt-3">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Tenant Builder</p>
          <h1 className="text-2xl font-bold">Enquiry Configuration</h1>
          <p className="text-sm text-muted-foreground">
            Add custom enquiry fields and manage test/package catalog for this tenant.
          </p>
        </div>
        <Button className="w-full sm:w-auto" disabled={!hasChanges || saving} onClick={() => void saveAll()}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="rounded-3xl border-white/80 bg-card/95">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Custom Enquiry Fields</CardTitle>
              <CardDescription>These fields are added to enquiry intake forms.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={openCreateField}>
              <Plus className="h-4 w-4" />
              Add Field
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {customFields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No custom enquiry fields yet.</p>
            ) : (
              customFields.map((field, index) => (
                <div key={field.key} className="rounded-2xl border border-white/70 bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{field.label}</p>
                      <p className="text-xs text-muted-foreground">{field.key}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary">{field.type}</Badge>
                        <Badge variant="outline">{field.required ? 'Required' : 'Optional'}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditField(index)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => removeField(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/80 bg-card/95">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Test Packages</CardTitle>
              <CardDescription>Add, edit, and enable/disable available tests/packages.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={openCreatePackage}>
              <Plus className="h-4 w-4" />
              Add Package
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {testPackages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No test packages configured.</p>
            ) : (
              testPackages.map((pkg, index) => (
                <div key={pkg.id} className="rounded-2xl border border-white/70 bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{pkg.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{pkg.description || 'No description'}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant={pkg.enabled ? 'secondary' : 'outline'}>
                          {pkg.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Badge variant="outline">{pkg.id}</Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditPackage(index)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => togglePackage(index)}>
                        {pkg.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => removePackage(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFieldIndex === null ? 'Add Enquiry Field' : 'Edit Enquiry Field'}</DialogTitle>
            <DialogDescription>Define an extra field for enquiry capture.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="enquiry-field-key">Field Key</Label>
              <Input
                id="enquiry-field-key"
                value={fieldForm.key}
                onChange={(event) => setFieldForm((current) => ({ ...current, key: event.target.value }))}
                placeholder="preferredDoctor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enquiry-field-label">Label</Label>
              <Input
                id="enquiry-field-label"
                value={fieldForm.label}
                onChange={(event) => setFieldForm((current) => ({ ...current, label: event.target.value }))}
                placeholder="Preferred Doctor"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enquiry-field-type">Type</Label>
              <Select
                id="enquiry-field-type"
                value={fieldForm.type}
                onChange={(event) =>
                  setFieldForm((current) => ({ ...current, type: event.target.value as FieldType }))
                }
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enquiry-field-placeholder">Placeholder</Label>
              <Input
                id="enquiry-field-placeholder"
                value={fieldForm.placeholder}
                onChange={(event) =>
                  setFieldForm((current) => ({ ...current, placeholder: event.target.value }))
                }
                placeholder="Optional placeholder"
              />
            </div>
          </div>

          {fieldForm.type === 'select' ? (
            <div className="space-y-2">
              <Label htmlFor="enquiry-field-options">Options (comma separated)</Label>
              <Textarea
                id="enquiry-field-options"
                value={fieldForm.optionsText}
                onChange={(event) =>
                  setFieldForm((current) => ({ ...current, optionsText: event.target.value }))
                }
                placeholder="Option A, Option B, Option C"
              />
            </div>
          ) : null}

          <Checkbox
            checked={fieldForm.required}
            label="Required field"
            onChange={(event) =>
              setFieldForm((current) => ({
                ...current,
                required: event.target.checked,
              }))
            }
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveField}>
              Save Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={packageDialogOpen} onOpenChange={setPackageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPackageIndex === null ? 'Add Test Package' : 'Edit Test Package'}</DialogTitle>
            <DialogDescription>Define package name, description, and active status.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="test-package-name">Package Name</Label>
              <Input
                id="test-package-name"
                value={packageForm.name}
                onChange={(event) =>
                  setPackageForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Diabetes Package"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-package-description">Description</Label>
              <Textarea
                id="test-package-description"
                value={packageForm.description}
                onChange={(event) =>
                  setPackageForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="Short description shown in settings"
              />
            </div>

            <Checkbox
              checked={packageForm.enabled}
              label="Enabled"
              onChange={(event) =>
                setPackageForm((current) => ({
                  ...current,
                  enabled: event.target.checked,
                }))
              }
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPackageDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePackage}>
              Save Package
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
