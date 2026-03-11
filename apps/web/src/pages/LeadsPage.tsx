import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import { MessageSquarePlus, Plus, Search } from 'lucide-react';
import type { Lead, LeadDetail, LeadFieldConfig, PipelineStage } from '@leadops/shared';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useTenant } from '../context/TenantContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Textarea } from '../components/ui/textarea';

type FormValue = string | boolean;
type FormState = Record<string, FormValue>;

const CORE_FIELD_KEYS = new Set(['name', 'email', 'phone', 'nextFollowUpAt', 'note', 'source']);

function statusVariant(status: Lead['status']): 'default' | 'success' | 'warning' | 'danger' | 'secondary' {
  if (status === 'WON') return 'success';
  if (status === 'LOST') return 'danger';
  if (status === 'PENDING') return 'warning';
  if (status === 'NEW') return 'default';
  return 'secondary';
}

function toDateTimeLocal(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function toIsoFromDateTimeLocal(value: string): string | null {
  if (!value) return null;

  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return null;

  const [year, month, day] = datePart.split('-').map((part) => parseInt(part, 10));
  const [hours, minutes] = timePart.split(':').map((part) => parseInt(part, 10));

  if ([year, month, day, hours, minutes].some((part) => Number.isNaN(part))) {
    return null;
  }

  const localDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(localDate.getTime())) {
    return null;
  }

  return localDate.toISOString();
}

function normalizeFieldValue(field: LeadFieldConfig, value: FormValue | undefined): string {
  if (field.type === 'boolean') {
    return '';
  }

  return typeof value === 'string' ? value : '';
}

function buildInitialForm(fields: LeadFieldConfig[]): FormState {
  const state: FormState = {};
  const defaultFollowup = toDateTimeLocal(new Date(Date.now() + 2 * 60 * 60 * 1000));

  fields.forEach((field) => {
    if (field.type === 'boolean') {
      state[field.key] = false;
      return;
    }

    if (field.key === 'nextFollowUpAt') {
      state[field.key] = defaultFollowup;
      return;
    }

    state[field.key] = '';
  });

  return state;
}

function inferStageKey(lead: Lead, stages: PipelineStage[]): string {
  if (lead.stageKey) {
    return lead.stageKey;
  }

  const direct = stages.find((stage) => stage.key === lead.status);
  if (direct) {
    return direct.key;
  }

  const byStatus = stages.find((stage) => stage.internalStatus === lead.status);
  if (byStatus) {
    return byStatus.key;
  }

  return stages[0]?.key ?? 'NEW';
}

function stageLabel(stageKey: string, stages: PipelineStage[]): string {
  return stages.find((stage) => stage.key === stageKey)?.label ?? stageKey;
}

function statusLabel(lead: Lead, stages: PipelineStage[], labels: Record<string, string>): string {
  const key = inferStageKey(lead, stages);
  const stage = stages.find((item) => item.key === key);

  if (stage) {
    return stage.label;
  }

  return labels[lead.status] ?? lead.status;
}

function intakeValue(lead: Lead, key: string): string {
  const intake = lead.intakeData;

  if (!intake || typeof intake !== 'object' || Array.isArray(intake)) {
    return 'N/A';
  }

  const value = (intake as Record<string, unknown>)[key];

  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (key.toLowerCase().includes('slot') || key.toLowerCase().includes('date')) {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString();
    }
  }

  return String(value);
}

function renderField(
  field: LeadFieldConfig,
  value: FormValue | undefined,
  onChange: (next: FormValue) => void,
): React.JSX.Element {
  const id = `create-${field.key}`;
  const label = `${field.label}${field.required ? ' *' : ''}`;

  if (field.type === 'boolean') {
    return (
      <div className="space-y-2" key={field.key}>
        <Label htmlFor={id}>{label}</Label>
        <label htmlFor={id} className="flex h-10 cursor-pointer items-center gap-3 rounded-md border border-input bg-background px-3">
          <input
            id={id}
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <span className="text-sm text-foreground">{Boolean(value) ? 'Yes' : 'No'}</span>
        </label>
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className="space-y-2" key={field.key}>
        <Label htmlFor={id}>{label}</Label>
        <select
          id={id}
          value={normalizeFieldValue(field, value)}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          required={field.required}
        >
          <option value="">Select {field.label.toLowerCase()}</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="space-y-2 sm:col-span-2" key={field.key}>
        <Label htmlFor={id}>{label}</Label>
        <Textarea
          id={id}
          value={normalizeFieldValue(field, value)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          required={field.required}
        />
      </div>
    );
  }

  const inputType =
    field.type === 'datetime'
      ? 'datetime-local'
      : field.type === 'email'
        ? 'email'
        : field.type === 'phone'
          ? 'tel'
          : 'text';

  return (
    <div className="space-y-2" key={field.key}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={inputType}
        value={normalizeFieldValue(field, value)}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        required={field.required}
      />
    </div>
  );
}

export function LeadsPage(): React.JSX.Element {
  const { dictionary, profile } = useTenant();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadDetail, setSelectedLeadDetail] = useState<LeadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>({});
  const [createStageKey, setCreateStageKey] = useState<string>('');

  const [stageDraft, setStageDraft] = useState<string>('');
  const [followupDraft, setFollowupDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');

  const sortedStages = useMemo(
    () => [...dictionary.pipelineStages].sort((a, b) => a.order - b.order),
    [dictionary.pipelineStages],
  );

  const coreFields = useMemo(
    () => dictionary.leadFields.filter((field) => field.section === 'core'),
    [dictionary.leadFields],
  );

  const intakeFields = useMemo(
    () => dictionary.leadFields.filter((field) => field.section === 'intake'),
    [dictionary.leadFields],
  );

  const loadLeads = (): void => {
    setLoading(true);
    api
      .get<Lead[]>('/v1/leads')
      .then(setLeads)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : `Failed to load ${dictionary.labels.leadPlural.toLowerCase()}`);
      })
      .finally(() => setLoading(false));
  };

  const loadLeadDetail = (id: string): void => {
    setDetailLoading(true);
    api
      .get<LeadDetail>(`/v1/leads/${id}`)
      .then((detail) => {
        setSelectedLeadDetail(detail);
        const inferred = inferStageKey(detail.lead, sortedStages);
        setStageDraft(inferred);
        setFollowupDraft(toDateTimeLocal(detail.lead.nextFollowUpAt));
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : `Failed to load ${dictionary.labels.leadSingular.toLowerCase()} detail`);
      })
      .finally(() => setDetailLoading(false));
  };

  useEffect(() => {
    setCreateForm(buildInitialForm(dictionary.leadFields));
    setCreateStageKey(sortedStages[0]?.key ?? '');
  }, [dictionary.leadFields, sortedStages]);

  useEffect(() => {
    loadLeads();
    setSelectedLeadId(null);
    setSelectedLeadDetail(null);
  }, [profile?.tenantId]);

  useEffect(() => {
    if (!selectedLeadId) {
      setSelectedLeadDetail(null);
      return;
    }

    loadLeadDetail(selectedLeadId);
  }, [selectedLeadId, profile?.tenantId]);

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const normalized = query.toLowerCase().trim();
      const matchesQuery =
        !normalized ||
        lead.name.toLowerCase().includes(normalized) ||
        (lead.phone ?? '').toLowerCase().includes(normalized);

      const currentStage = inferStageKey(lead, sortedStages);
      const matchesStage = stageFilter === 'ALL' ? true : currentStage === stageFilter;

      return matchesQuery && matchesStage;
    });
  }, [leads, query, sortedStages, stageFilter]);

  const createLead = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    for (const field of dictionary.leadFields) {
      if (!field.required) {
        continue;
      }

      const value = createForm[field.key];
      const missing = field.type === 'boolean' ? value === undefined || value === null : !String(value ?? '').trim();

      if (missing) {
        toast.error(`${field.label} is required`);
        return;
      }
    }

    const name = String(createForm.name ?? '').trim();
    if (!name) {
      toast.error(`${dictionary.labels.leadSingular} name is required`);
      return;
    }

    const nextFollowUpRaw = String(createForm.nextFollowUpAt ?? '');
    const nextFollowUpAtIso = toIsoFromDateTimeLocal(nextFollowUpRaw);

    if (!nextFollowUpAtIso) {
      toast.error('Invalid next follow-up datetime');
      return;
    }

    const intakeData: Record<string, string | boolean> = {};

    dictionary.leadFields.forEach((field) => {
      if (CORE_FIELD_KEYS.has(field.key)) {
        return;
      }

      const raw = createForm[field.key];

      if (raw === undefined || raw === null) {
        return;
      }

      if (field.type === 'boolean') {
        intakeData[field.key] = Boolean(raw);
        return;
      }

      const text = String(raw).trim();
      if (!text) {
        return;
      }

      if (field.type === 'datetime') {
        const iso = toIsoFromDateTimeLocal(text);
        intakeData[field.key] = iso ?? text;
        return;
      }

      intakeData[field.key] = text;
    });

    setCreating(true);

    try {
      await api.post('/v1/leads', {
        name,
        stageKey: createStageKey || undefined,
        nextFollowUpAt: nextFollowUpAtIso,
        email: String(createForm.email ?? '').trim() || undefined,
        phone: String(createForm.phone ?? '').trim() || undefined,
        source: String(createForm.source ?? '').trim() || undefined,
        note: String(createForm.note ?? '').trim() || undefined,
        intakeData: Object.keys(intakeData).length > 0 ? intakeData : undefined,
      });

      toast.success(`${dictionary.labels.leadSingular} created`);
      setFormOpen(false);
      setCreateForm(buildInitialForm(dictionary.leadFields));
      setCreateStageKey(sortedStages[0]?.key ?? '');
      loadLeads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to create ${dictionary.labels.leadSingular.toLowerCase()}`);
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (): Promise<void> => {
    if (!selectedLeadDetail || !stageDraft) {
      return;
    }

    try {
      const nextFollowUpAtIso = followupDraft ? toIsoFromDateTimeLocal(followupDraft) : null;
      await api.patch(`/v1/leads/${selectedLeadDetail.lead.id}/status`, {
        stageKey: stageDraft,
        nextFollowUpAt: nextFollowUpAtIso ?? undefined,
      });

      toast.success(`${dictionary.labels.stageLabel} updated`);
      loadLeads();
      loadLeadDetail(selectedLeadDetail.lead.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update stage');
    }
  };

  const addNote = async (): Promise<void> => {
    if (!selectedLeadDetail || !noteDraft.trim()) {
      return;
    }

    try {
      await api.post(`/v1/leads/${selectedLeadDetail.lead.id}/notes`, { note: noteDraft.trim() });
      toast.success('Note added');
      setNoteDraft('');
      loadLeadDetail(selectedLeadDetail.lead.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add note');
    }
  };

  const leadSingularLower = dictionary.labels.leadSingular.toLowerCase();
  const leadPluralLower = dictionary.labels.leadPlural.toLowerCase();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2 pt-2 sm:pt-3">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Pipeline</p>
          <h1 className="text-2xl font-bold">{dictionary.labels.leadPlural}</h1>
          <p className="text-sm text-muted-foreground">
            Track {leadSingularLower} stage, next follow-up, and activity timeline.
          </p>
        </div>

        <Button onClick={() => setFormOpen((open) => !open)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          {formOpen ? 'Close form' : `New ${leadSingularLower}`}
        </Button>
      </div>

      {formOpen ? (
        <Card className="rounded-3xl border-white/80 bg-card/95">
          <CardHeader>
            <CardTitle>{dictionary.labels.leadCreateTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={(event) => void createLead(event)} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="create-stage">{dictionary.labels.stageLabel}</Label>
                  <select
                    id="create-stage"
                    value={createStageKey}
                    onChange={(event) => setCreateStageKey(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {sortedStages.map((stage) => (
                      <option key={stage.key} value={stage.key}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {coreFields.map((field) =>
                  renderField(field, createForm[field.key], (next) => {
                    setCreateForm((prev) => ({ ...prev, [field.key]: next }));
                  }),
                )}
              </div>

              {intakeFields.length > 0 ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold">Intake Details</p>
                    <p className="text-xs text-muted-foreground">Fields are configured per tenant workflow.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {intakeFields.map((field) =>
                      renderField(field, createForm[field.key], (next) => {
                        setCreateForm((prev) => ({ ...prev, [field.key]: next }));
                      }),
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex justify-end">
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : dictionary.labels.leadCreateTitle}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-3xl border-white/80 bg-card/95">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${leadSingularLower}`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm lg:w-auto"
            >
              <option value="ALL">All stages</option>
              {sortedStages.map((stage) => (
                <option key={stage.key} value={stage.key}>
                  {stage.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <p className="font-semibold">No {leadPluralLower} found</p>
              <p className="mt-1 text-sm text-muted-foreground">{dictionary.labels.emptyLeads}</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filtered.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    className="w-full rounded-2xl border border-white/70 bg-background/70 p-4 text-left transition-colors hover:bg-secondary/40"
                    onClick={() => setSelectedLeadId(lead.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{lead.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{lead.phone ?? lead.email ?? 'No contact'}</p>
                      </div>
                      <Badge variant={statusVariant(lead.status)}>
                        {statusLabel(lead, sortedStages, dictionary.labels.statusLabels)}
                      </Badge>
                    </div>

                    <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                      <p>
                        <span className="font-medium text-foreground">{dictionary.labels.followupLabel}:</span>{' '}
                        {lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleString() : 'N/A'}
                      </p>
                      {dictionary.isDiagnosticsLab ? (
                        <p>
                          <span className="font-medium text-foreground">Test:</span> {intakeValue(lead, 'testOrPackage')}
                        </p>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{dictionary.labels.leadSingular}</TableHead>
                      <TableHead>{dictionary.labels.stageLabel}</TableHead>
                      <TableHead>{dictionary.labels.followupLabel}</TableHead>
                      <TableHead>Contact</TableHead>
                      {dictionary.isDiagnosticsLab ? <TableHead>Test / Package</TableHead> : null}
                      {dictionary.isDiagnosticsLab ? <TableHead>Home Collection</TableHead> : null}
                      {dictionary.isDiagnosticsLab ? <TableHead>Preferred Slot</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((lead) => (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedLeadId(lead.id)}
                      >
                        <TableCell className="font-semibold">{lead.name}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(lead.status)}>
                            {statusLabel(lead, sortedStages, dictionary.labels.statusLabels)}
                          </Badge>
                        </TableCell>
                        <TableCell>{lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleString() : 'N/A'}</TableCell>
                        <TableCell>
                          <div>{lead.email ?? 'No email'}</div>
                          <div className="text-xs text-muted-foreground">{lead.phone ?? 'No phone'}</div>
                        </TableCell>
                        {dictionary.isDiagnosticsLab ? <TableCell>{intakeValue(lead, 'testOrPackage')}</TableCell> : null}
                        {dictionary.isDiagnosticsLab ? <TableCell>{intakeValue(lead, 'homeCollection')}</TableCell> : null}
                        {dictionary.isDiagnosticsLab ? <TableCell>{intakeValue(lead, 'preferredSlot')}</TableCell> : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedLeadId} onOpenChange={(open) => !open && setSelectedLeadId(null)}>
        <SheetContent className="border-white/80 bg-card p-5 shadow-[0_28px_60px_-32px_rgba(15,23,42,0.45)] sm:p-6">
          <SheetHeader>
            <SheetTitle>{selectedLeadDetail?.lead.name ?? `${dictionary.labels.leadSingular} detail`}</SheetTitle>
            <SheetDescription>
              {dictionary.labels.stageLabel}, follow-up commitments, notes, and activity timeline.
            </SheetDescription>
          </SheetHeader>

          {detailLoading || !selectedLeadDetail ? (
            <div className="mt-6 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{dictionary.labels.stageLabel}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <select
                    value={stageDraft || inferStageKey(selectedLeadDetail.lead, sortedStages)}
                    onChange={(event) => setStageDraft(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {sortedStages.map((stage) => (
                      <option key={stage.key} value={stage.key}>
                        {stage.label}
                      </option>
                    ))}
                  </select>

                  <div className="space-y-2">
                    <Label htmlFor="next-followup">Next follow-up</Label>
                    <Input
                      id="next-followup"
                      type="datetime-local"
                      value={followupDraft}
                      onChange={(event) => setFollowupDraft(event.target.value)}
                    />
                  </div>

                  <Button onClick={() => void updateStatus()} className="w-full">
                    Save stage
                  </Button>
                </CardContent>
              </Card>

              {dictionary.isDiagnosticsLab ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Report Workflow</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      Current stage:{' '}
                      <span className="font-semibold">{stageLabel(inferStageKey(selectedLeadDetail.lead, sortedStages), sortedStages)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Post-report follow-up tasks are surfaced as first-class items when report delivery milestone is reached.
                    </p>
                    <div className="space-y-2">
                      {selectedLeadDetail.followUps
                        .filter((followUp) => followUp.kind === 'POST_REPORT')
                        .map((followUp) => (
                          <div key={followUp.id} className="rounded-md border bg-accent/40 p-3">
                            <p className="font-medium">Post-report follow-up</p>
                            <p className="text-xs text-muted-foreground">
                              Due {new Date(followUp.scheduledAt).toLocaleString()} • {followUp.done ? 'Done' : 'Pending'}
                            </p>
                            {followUp.note ? <p className="mt-1 text-xs text-muted-foreground">{followUp.note}</p> : null}
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{dictionary.labels.followupLabel} tasks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedLeadDetail.followUps.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No follow-up tasks yet.</p>
                    ) : (
                      selectedLeadDetail.followUps.map((followUp) => (
                        <div key={followUp.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between gap-3">
                            <Badge variant={followUp.kind === 'POST_REPORT' ? 'warning' : 'secondary'}>
                              {followUp.kind.replace('_', ' ')}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {followUp.done ? 'Done' : 'Pending'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium">{new Date(followUp.scheduledAt).toLocaleString()}</p>
                          {followUp.note ? <p className="mt-1 text-xs text-muted-foreground">{followUp.note}</p> : null}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Add note</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Capture call outcomes, objections, next steps..."
                  />
                  <Button variant="secondary" onClick={() => void addNote()} className="w-full">
                    <MessageSquarePlus className="h-4 w-4" />
                    Add note
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Activity timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedLeadDetail.activities.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No activity yet.</p>
                    ) : (
                      selectedLeadDetail.activities.map((activity) => (
                        <div key={activity.id} className="rounded-lg border p-3">
                          <p className="text-sm font-semibold">{activity.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(activity.createdAt).toLocaleString()}
                            {activity.actor?.name ? ` • ${activity.actor.name}` : ''}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
