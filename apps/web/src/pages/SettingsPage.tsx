import React, { useEffect, useMemo, useState } from 'react';
import type { TenantSettings, UpdateTenantSettingsDto } from '@leadops/shared';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTenant } from '../context/TenantContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import {
  buildTimezoneOptions,
  filterTimezoneOptions,
  isTimezoneSelectionValid,
  isValidBusinessTimeRange,
  normalizeTimezoneValue,
} from '../lib/timezone-options';

export function SettingsPage(): React.JSX.Element {
  const { can, user } = useAuth();
  const { dictionary, profile, refreshTenant } = useTenant();
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingReminderSettings, setSavingReminderSettings] = useState(false);
  const [timezoneDraft, setTimezoneDraft] = useState('');
  const [timezoneSearch, setTimezoneSearch] = useState('');
  const [businessStartDraft, setBusinessStartDraft] = useState('');
  const [businessEndDraft, setBusinessEndDraft] = useState('');
  const [firstReminderDraft, setFirstReminderDraft] = useState('');
  const [escalationDraft, setEscalationDraft] = useState('');
  const [postReportDraft, setPostReportDraft] = useState('');
  const canManageReminderSettings = can('settings.manage') && !!(user?.isTenantAdmin || user?.isSuperAdmin);

  useEffect(() => {
    setLoading(true);
    api
      .get<TenantSettings>('/v1/settings')
      .then((response) => {
        setSettings(response);
        setTimezoneDraft(response.timezone);
        setTimezoneSearch('');
        setBusinessStartDraft(response.businessStart);
        setBusinessEndDraft(response.businessEnd);
        setFirstReminderDraft(String(response.reminderRules.firstReminderMinutes));
        setEscalationDraft(String(response.reminderRules.escalationMinutes));
        setPostReportDraft(String(response.reminderRules.postReportFollowupDays));
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load settings');
      })
      .finally(() => setLoading(false));
  }, [profile?.tenantId]);

  const timezoneOptions = useMemo(
    () => buildTimezoneOptions(settings?.timezone ?? timezoneDraft),
    [settings?.timezone, timezoneDraft],
  );

  const visibleTimezoneOptions = useMemo(
    () => filterTimezoneOptions(timezoneOptions, timezoneSearch, timezoneDraft),
    [timezoneDraft, timezoneOptions, timezoneSearch],
  );

  const saveReminderSettings = async (): Promise<void> => {
    if (!settings) {
      return;
    }

    const firstReminderMinutes = Number.parseInt(firstReminderDraft, 10);
    const escalationMinutes = Number.parseInt(escalationDraft, 10);
    const postReportFollowupDays = Number.parseInt(postReportDraft, 10);

    if (
      !Number.isFinite(firstReminderMinutes)
      || !Number.isFinite(escalationMinutes)
      || !Number.isFinite(postReportFollowupDays)
    ) {
      toast.error('Reminder values must be valid numbers');
      return;
    }

    const normalizedTimezone = normalizeTimezoneValue(timezoneDraft);
    if (!isTimezoneSelectionValid(normalizedTimezone, timezoneOptions)) {
      toast.error('Select a valid timezone from dropdown');
      return;
    }

    if (!businessStartDraft || !businessEndDraft) {
      toast.error('Business start and end time are required');
      return;
    }

    if (!isValidBusinessTimeRange(businessStartDraft, businessEndDraft)) {
      toast.error('Business start must be earlier than business end');
      return;
    }

    setSavingReminderSettings(true);

    try {
      const payload: UpdateTenantSettingsDto = {
        timezone: normalizedTimezone,
        businessStart: businessStartDraft,
        businessEnd: businessEndDraft,
        reminderRules: {
          firstReminderMinutes,
          escalationMinutes,
          postReportFollowupDays,
        },
      };

      const response = await api.patch<TenantSettings>('/v1/settings', payload);
      setSettings(response);
      setTimezoneDraft(response.timezone);
      setTimezoneSearch('');
      setBusinessStartDraft(response.businessStart);
      setBusinessEndDraft(response.businessEnd);
      setFirstReminderDraft(String(response.reminderRules.firstReminderMinutes));
      setEscalationDraft(String(response.reminderRules.escalationMinutes));
      setPostReportDraft(String(response.reminderRules.postReportFollowupDays));
      await refreshTenant();
      toast.success('Reminder settings updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update reminder settings');
    } finally {
      setSavingReminderSettings(false);
    }
  };

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

          <Card data-tour-id="settings-reminders" className="rounded-3xl border-white/80">
            <CardHeader>
              <CardTitle>Reminder Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {canManageReminderSettings ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Timezone
                    </label>
                    <Input
                      value={timezoneSearch}
                      onChange={(event) => setTimezoneSearch(event.target.value)}
                      placeholder="Search timezone"
                    />
                    <Select
                      value={timezoneDraft}
                      onChange={(event) => setTimezoneDraft(event.target.value)}
                    >
                      {visibleTimezoneOptions.length === 0 ? (
                        <option value="" disabled>No matching timezones</option>
                      ) : (
                        visibleTimezoneOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label} ({option.value})
                          </option>
                        ))
                      )}
                    </Select>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Business Start
                      </label>
                      <Input
                        type="time"
                        step={60}
                        value={businessStartDraft}
                        onChange={(event) => setBusinessStartDraft(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Business End
                      </label>
                      <Input
                        type="time"
                        step={60}
                        value={businessEndDraft}
                        onChange={(event) => setBusinessEndDraft(event.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Initial Reminder (min)
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={firstReminderDraft}
                        onChange={(event) => setFirstReminderDraft(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Escalation (min)
                      </label>
                      <Input
                        type="number"
                        min={0}
                        value={escalationDraft}
                        onChange={(event) => setEscalationDraft(event.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        Post Report (days)
                      </label>
                      <Input
                        type="number"
                        min={1}
                        value={postReportDraft}
                        onChange={(event) => setPostReportDraft(event.target.value)}
                      />
                    </div>
                  </div>

                  <Button disabled={savingReminderSettings} onClick={() => void saveReminderSettings()}>
                    {savingReminderSettings ? 'Saving...' : 'Save Reminder Rules'}
                  </Button>
                </div>
              ) : (
                <>
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
                    <span className="font-semibold">Post-report follow-up:</span> {profile?.displayConfig.followupRules.postReportFollowupDays ?? settings.reminderRules.postReportFollowupDays} days
                  </p>
                </>
              )}
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
