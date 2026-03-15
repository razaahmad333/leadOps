import React from 'react';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Select } from '../../../../components/ui/select';
import type { TenantSettingsDraft } from '../../platform-admin.types';

type TimezoneOption = {
  label: string;
  value: string;
};

type SettingsTabProps = {
  tenantSettingsDraft: TenantSettingsDraft | null;
  setTenantSettingsDraft: React.Dispatch<React.SetStateAction<TenantSettingsDraft | null>>;
  drawerTimezoneSearch: string;
  setDrawerTimezoneSearch: React.Dispatch<React.SetStateAction<string>>;
  visibleDrawerTimezoneOptions: TimezoneOption[];
  savingTenantSettings: boolean;
  onSave: () => void;
};

export function SettingsTab(props: SettingsTabProps): React.JSX.Element | null {
  const {
    tenantSettingsDraft,
    setTenantSettingsDraft,
    drawerTimezoneSearch,
    setDrawerTimezoneSearch,
    visibleDrawerTimezoneOptions,
    savingTenantSettings,
    onSave,
  } = props;

  if (!tenantSettingsDraft) {
    return null;
  }

  return (
    <Card className="rounded-2xl border-white/70 bg-card/95">
      <CardContent className="space-y-4 p-4">
        <div className="space-y-2">
          <Label htmlFor="drawer-timezone">Timezone</Label>
          <Input
            id="drawer-timezone-search"
            value={drawerTimezoneSearch}
            onChange={(event) => setDrawerTimezoneSearch(event.target.value)}
            placeholder="Search timezone"
          />
          <Select
            id="drawer-timezone"
            value={tenantSettingsDraft.timezone}
            onChange={(event) =>
              setTenantSettingsDraft((current) =>
                current ? { ...current, timezone: event.target.value } : current,
              )
            }
          >
            {visibleDrawerTimezoneOptions.length === 0 ? (
              <option value="" disabled>No matching timezones</option>
            ) : (
              visibleDrawerTimezoneOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.value})
                </option>
              ))
            )}
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="drawer-business-start">Business Start</Label>
            <Input
              id="drawer-business-start"
              type="time"
              step={60}
              value={tenantSettingsDraft.businessStart}
              onChange={(event) =>
                setTenantSettingsDraft((current) =>
                  current ? { ...current, businessStart: event.target.value } : current,
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="drawer-business-end">Business End</Label>
            <Input
              id="drawer-business-end"
              type="time"
              step={60}
              value={tenantSettingsDraft.businessEnd}
              onChange={(event) =>
                setTenantSettingsDraft((current) =>
                  current ? { ...current, businessEnd: event.target.value } : current,
                )
              }
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="drawer-default-followup">Default Next Follow-up (min)</Label>
            <Input
              id="drawer-default-followup"
              type="number"
              min={1}
              value={tenantSettingsDraft.defaultLeadFollowupMinutes}
              onChange={(event) =>
                setTenantSettingsDraft((current) =>
                  current ? { ...current, defaultLeadFollowupMinutes: event.target.value } : current,
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="drawer-first-reminder">Initial Reminder (min)</Label>
            <Input
              id="drawer-first-reminder"
              type="number"
              min={0}
              value={tenantSettingsDraft.firstReminderMinutes}
              onChange={(event) =>
                setTenantSettingsDraft((current) =>
                  current ? { ...current, firstReminderMinutes: event.target.value } : current,
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="drawer-escalation">Escalation (min)</Label>
            <Input
              id="drawer-escalation"
              type="number"
              min={0}
              value={tenantSettingsDraft.escalationMinutes}
              onChange={(event) =>
                setTenantSettingsDraft((current) =>
                  current ? { ...current, escalationMinutes: event.target.value } : current,
                )
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="drawer-post-report">Post Report (days)</Label>
            <Input
              id="drawer-post-report"
              type="number"
              min={1}
              value={tenantSettingsDraft.postReportFollowupDays}
              onChange={(event) =>
                setTenantSettingsDraft((current) =>
                  current ? { ...current, postReportFollowupDays: event.target.value } : current,
                )
              }
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button disabled={savingTenantSettings} onClick={onSave}>
            {savingTenantSettings ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
