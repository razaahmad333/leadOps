import React, { useEffect, useState } from 'react';
import type { TenantSettings } from '@leadops/shared';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';

export function SettingsPage(): React.JSX.Element {
  const { can, user } = useAuth();
  const { dictionary, profile } = useTenant();
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<TenantSettings>('/v1/settings')
      .then(setSettings)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load settings');
      })
      .finally(() => setLoading(false));
  }, [profile?.tenantId]);

  return (
    <div className="space-y-5">
      <div className="space-y-2 pt-2 sm:pt-3">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Workspace Config</p>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline stages, reminder rules, templates, and display configuration.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {can('users.manage') ? (
          <Card className="rounded-3xl border-white/80 bg-card/95">
            <CardHeader>
              <CardTitle>Team</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Manage users, branch scope, and full-access admins.
              </p>
              <Button asChild variant="outline">
                <Link to="/settings/team">Open Team</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {can('roles.manage') ? (
          <Card className="rounded-3xl border-white/80 bg-card/95">
            <CardHeader>
              <CardTitle>Roles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Configure reusable permission bundles for your tenant.
              </p>
              <Button asChild variant="outline">
                <Link to="/settings/roles">Open Roles</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {can('permissions.view') ? (
          <Card className="rounded-3xl border-white/80 bg-card/95">
            <CardHeader>
              <CardTitle>Permissions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Review the live permission catalog used across the platform.
              </p>
              <Button asChild variant="outline">
                <Link to="/settings/permissions">Open Permissions</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {(user?.isTenantAdmin || user?.isSuperAdmin) && can('settings.view') ? (
          <Card className="rounded-3xl border-white/80 bg-card/95">
            <CardHeader>
              <CardTitle>Enquiry Builder</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Add custom enquiry fields and manage test packages for this tenant.
              </p>
              <Button asChild variant="outline">
                <Link to="/settings/intake">Open Builder</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !settings ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">No settings found.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-3xl border-white/80">
            <CardHeader>
              <CardTitle>Pipeline Stages</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {[...dictionary.pipelineStages]
                .sort((a, b) => a.order - b.order)
                .map((stage) => (
                  <Badge key={stage.key} variant={stage.terminal ? 'outline' : 'secondary'}>
                    {stage.label}
                  </Badge>
                ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/80">
            <CardHeader>
              <CardTitle>Reminder Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                <span className="font-semibold">Timezone:</span> {settings.timezone}
              </p>
              <p>
                <span className="font-semibold">Business window:</span> {settings.businessStart} - {settings.businessEnd}
              </p>
              <p>
                <span className="font-semibold">Initial reminder:</span> {profile?.displayConfig.followupRules.firstReminderMinutes ?? settings.reminderRules.firstReminderMinutes} minutes
              </p>
              <p>
                <span className="font-semibold">Escalation:</span> {profile?.displayConfig.followupRules.escalationMinutes ?? settings.reminderRules.escalationMinutes} minutes
              </p>
              <p>
                <span className="font-semibold">Post-report follow-up:</span> {profile?.displayConfig.followupRules.postReportFollowupDays ?? 3} days
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/80">
            <CardHeader>
              <CardTitle>Dashboard Cards</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dictionary.dashboardCards.map((card) => (
                <div key={card.key} className="rounded-md border p-3 text-sm">
                  <p className="font-semibold">{card.label}</p>
                  <p className="text-xs text-muted-foreground">Metric key: {card.metricKey}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/80">
            <CardHeader>
              <CardTitle>Intake Fields</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dictionary.leadFields.map((field) => (
                <div key={field.key} className="rounded-md border p-3 text-sm">
                  <p className="font-semibold">{field.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Key: {field.key} • Type: {field.type} • {field.required ? 'Required' : 'Optional'}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-white/80 lg:col-span-2">
            <CardHeader>
              <CardTitle>Templates (Read-only)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {settings.templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No templates configured for this tenant.</p>
              ) : (
                settings.templates.map((template) => (
                  <div key={template.key} className="rounded-lg border p-4">
                    <p className="font-semibold">{template.title}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{template.body}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
