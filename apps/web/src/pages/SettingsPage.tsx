import React, { useEffect, useState } from 'react';
import type { TenantSettings } from '@leadops/shared';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';

export function SettingsPage(): React.JSX.Element {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<TenantSettings>('/v1/settings')
      .then(setSettings)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load settings');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Pipeline stages, reminder rules, and template placeholders.</p>
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
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Stages</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {settings.stages.map((stage) => (
                <Badge key={stage} variant="secondary">
                  {stage}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
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
                <span className="font-semibold">Initial reminder:</span> {settings.reminderRules.firstReminderMinutes} minutes
              </p>
              <p>
                <span className="font-semibold">Escalation:</span> {settings.reminderRules.escalationMinutes} minutes
              </p>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Templates (Read-only)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {settings.templates.map((template) => (
                <div key={template.key} className="rounded-lg border p-4">
                  <p className="font-semibold">{template.title}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{template.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
