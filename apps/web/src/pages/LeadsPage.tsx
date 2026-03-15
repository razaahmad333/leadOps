import React, { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { MessageSquarePlus, Plus, Search } from 'lucide-react';
import {
  REALTIME_INVALIDATION_EVENTS,
  type Branch,
  type Lead,
  type LeadDetail,
  type LeadFieldConfig,
  type LeadListResponse,
  type PipelineStage,
} from '@leadops/shared';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useTenant } from '../context/TenantContext';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import {
  buildAccessibleBranches,
  resolveBranchFilterValue,
  resolveCreateBranchDefault,
} from '../lib/branch-scope';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { RefreshButton } from '../components/ui/refresh-button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Textarea } from '../components/ui/textarea';

type FormValue = string | boolean;
type FormState = Record<string, FormValue>;

const CORE_FIELD_KEYS = new Set(['name', 'email', 'phone', 'nextFollowUpAt', 'note', 'source']);
const PAGE_SIZE = 20;

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

function buildInitialForm(fields: LeadFieldConfig[], defaultLeadFollowupMinutes: number): FormState {
  const state: FormState = {};
  const defaultFollowup = toDateTimeLocal(new Date(Date.now() + defaultLeadFollowupMinutes * 60 * 1000));

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

function stagePurposeOptions(stageKey: string, stages: PipelineStage[]) {
  return stages.find((stage) => stage.key === stageKey)?.followupPurposes ?? [];
}

function defaultStagePurposeKey(stageKey: string, stages: PipelineStage[]): string {
  const stage = stages.find((item) => item.key === stageKey);
  return stage?.defaultFollowupPurposeKey ?? stage?.followupPurposes[0]?.key ?? 'general_followup';
}

function stageFollowupGuidance(stageKey: string, stages: PipelineStage[]): string | null {
  return stages.find((stage) => stage.key === stageKey)?.followupGuidance ?? null;
}

function followupPurposeLabel(
  followUp: { purposeKey: string | null; purposeLabel: string | null },
  stages: PipelineStage[],
): string {
  if (followUp.purposeLabel) {
    return followUp.purposeLabel;
  }

  if (followUp.purposeKey) {
    for (const stage of stages) {
      const purpose = stage.followupPurposes.find((item) => item.key === followUp.purposeKey);
      if (purpose) {
        return purpose.label;
      }
    }
  }

  return 'General Follow-up';
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
  optionsOverride?: string[],
  disabled?: boolean,
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
          disabled={disabled}
        >
          <option value="">Select {field.label.toLowerCase()}</option>
          {(optionsOverride ?? field.options ?? []).map((option) => (
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
  const { user, selectedBranchId } = useAuth();
  const { subscribeInvalidation, joinLeadRoom, leaveLeadRoom } = useRealtime();
  const { dictionary, profile } = useTenant();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), 350);
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadDetail, setSelectedLeadDetail] = useState<LeadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>({});
  const [createStageKey, setCreateStageKey] = useState<string>('');
  const [createPurposeKey, setCreatePurposeKey] = useState<string>('');
  const [createBranchId, setCreateBranchId] = useState<string>('');

  const [stageDraft, setStageDraft] = useState<string>('');
  const [followupDraft, setFollowupDraft] = useState('');
  const [followupPurposeDraft, setFollowupPurposeDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [realtimeLeadsVersion, setRealtimeLeadsVersion] = useState(0);
  const [realtimeDetailVersion, setRealtimeDetailVersion] = useState(0);
  const leadsRealtimeTimerRef = useRef<number | null>(null);
  const detailRealtimeTimerRef = useRef<number | null>(null);

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
  const intakeSummaryFields = useMemo(
    () => intakeFields.slice(0, 3),
    [intakeFields],
  );
  const defaultLeadFollowupMinutes = profile?.displayConfig.followupRules.defaultLeadFollowupMinutes ?? 120;
  const accessibleBranches = useMemo<Branch[]>(() => buildAccessibleBranches(user), [user]);
  const branchNameById = useMemo(() => {
    return new Map(accessibleBranches.map((branch) => [branch.id, branch.name]));
  }, [accessibleBranches]);
  const branchOptions = useMemo(
    () => accessibleBranches.map((branch) => ({ id: branch.id, name: branch.name })),
    [accessibleBranches],
  );
  const canChooseBranch = accessibleBranches.length > 1;
  const opdDirectory = profile?.displayConfig.opdDirectory;
  const activeOpdDepartments = useMemo(
    () => (opdDirectory?.departments ?? []).filter((department) => department.isActive),
    [opdDirectory?.departments],
  );
  const enabledOpdDoctors = useMemo(
    () => (opdDirectory?.doctors ?? []).filter((doctor) => doctor.enabled),
    [opdDirectory?.doctors],
  );
  const selectedDepartmentName = useMemo(() => {
    const value = createForm.departmentOrSpeciality;
    return typeof value === 'string' ? value.trim() : '';
  }, [createForm.departmentOrSpeciality]);
  const selectedDepartmentId = useMemo(
    () => activeOpdDepartments.find((department) => department.name === selectedDepartmentName)?.id ?? null,
    [activeOpdDepartments, selectedDepartmentName],
  );
  const opdDepartmentOptions = useMemo(
    () => activeOpdDepartments.map((department) => department.name),
    [activeOpdDepartments],
  );
  const opdDoctorOptions = useMemo(() => {
    if (!selectedDepartmentId) {
      return [];
    }

    return enabledOpdDoctors
      .filter((doctor) => doctor.departmentIds.includes(selectedDepartmentId))
      .map((doctor) => doctor.name);
  }, [enabledOpdDoctors, selectedDepartmentId]);

  const loadLeads = useCallback((): void => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });

    if (debouncedQuery) {
      params.set('search', debouncedQuery);
    }

    if (stageFilter !== 'ALL') {
      params.set('stageKey', stageFilter);
    }

    if (createdFrom) {
      params.set('createdFrom', new Date(`${createdFrom}T00:00:00`).toISOString());
    }

    if (createdTo) {
      params.set('createdTo', new Date(`${createdTo}T23:59:59.999`).toISOString());
    }

    if (canChooseBranch && branchFilter !== 'ALL') {
      params.set('branchId', branchFilter);
    }

    api
      .get<LeadListResponse>(`/v1/leads?${params.toString()}`)
      .then((response) => {
        if (response.total > 0 && page > response.totalPages) {
          setPage(response.totalPages);
          return;
        }

        setLeads(response.items);
        setTotal(response.total);
        setTotalPages(response.totalPages);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : `Failed to load ${dictionary.labels.leadPlural.toLowerCase()}`);
        setLeads([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [
    branchFilter,
    canChooseBranch,
    debouncedQuery,
    dictionary.labels.leadPlural,
    page,
    profile?.tenantId,
    selectedBranchId,
    stageFilter,
    createdFrom,
    createdTo,
  ]);

  const loadLeadDetail = (id: string): void => {
    setDetailLoading(true);
    api
      .get<LeadDetail>(`/v1/leads/${id}`)
      .then((detail) => {
        setSelectedLeadDetail(detail);
        const inferred = inferStageKey(detail.lead, sortedStages);
        const pendingGeneralFollowUp = detail.followUps.find((followUp) => !followUp.done && followUp.kind === 'GENERAL')
          ?? detail.followUps.find((followUp) => !followUp.done)
          ?? null;
        setStageDraft(inferred);
        setFollowupDraft(toDateTimeLocal(detail.lead.nextFollowUpAt));
        setFollowupPurposeDraft(
          pendingGeneralFollowUp?.purposeKey ?? defaultStagePurposeKey(inferred, sortedStages),
        );
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : `Failed to load ${dictionary.labels.leadSingular.toLowerCase()} detail`);
      })
      .finally(() => setDetailLoading(false));
  };

  useEffect(() => {
    setCreateForm(buildInitialForm(dictionary.leadFields, defaultLeadFollowupMinutes));
    const defaultStageKey = sortedStages[0]?.key ?? '';
    setCreateStageKey(defaultStageKey);
    setCreatePurposeKey(defaultStagePurposeKey(defaultStageKey, sortedStages));
  }, [defaultLeadFollowupMinutes, dictionary.leadFields, sortedStages]);

  useEffect(() => {
    setCreateBranchId((current) => {
      return resolveCreateBranchDefault(
        current,
        selectedBranchId,
        user?.defaultBranchId,
        branchOptions,
      );
    });
  }, [branchOptions, selectedBranchId, user?.defaultBranchId]);

  useEffect(() => {
    setBranchFilter((current) => {
      return resolveBranchFilterValue(current, selectedBranchId, branchOptions);
    });
  }, [branchOptions, selectedBranchId]);

  useEffect(() => {
    setPage(1);
  }, [branchFilter, debouncedQuery, profile?.tenantId, selectedBranchId, stageFilter, createdFrom, createdTo]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads, realtimeLeadsVersion]);

  useEffect(() => {
    setSelectedLeadId(null);
    setSelectedLeadDetail(null);
  }, [profile?.tenantId, selectedBranchId]);

  useEffect(() => {
    if (!selectedLeadId) {
      setSelectedLeadDetail(null);
      return;
    }

    loadLeadDetail(selectedLeadId);
  }, [selectedLeadId, profile?.tenantId, realtimeDetailVersion, selectedBranchId]);

  useEffect(() => {
    if (!selectedLeadId) {
      return;
    }

    joinLeadRoom(selectedLeadId);
    return () => {
      leaveLeadRoom(selectedLeadId);
    };
  }, [joinLeadRoom, leaveLeadRoom, selectedLeadId]);

  useEffect(() => {
    return subscribeInvalidation((event) => {
      if (!user || event.tenantId !== user.tenantId) {
        return;
      }

      if (selectedBranchId && event.branchId && event.branchId !== selectedBranchId) {
        return;
      }

      if (event.event === REALTIME_INVALIDATION_EVENTS.LEADS_INVALIDATE) {
        if (leadsRealtimeTimerRef.current) {
          window.clearTimeout(leadsRealtimeTimerRef.current);
        }

        leadsRealtimeTimerRef.current = window.setTimeout(() => {
          setRealtimeLeadsVersion((current) => current + 1);
        }, 250);
        return;
      }

      if (
        event.event === REALTIME_INVALIDATION_EVENTS.LEAD_DETAIL_INVALIDATE
        && selectedLeadId
        && event.leadId === selectedLeadId
      ) {
        if (detailRealtimeTimerRef.current) {
          window.clearTimeout(detailRealtimeTimerRef.current);
        }

        detailRealtimeTimerRef.current = window.setTimeout(() => {
          setRealtimeDetailVersion((current) => current + 1);
        }, 250);
      }
    });
  }, [selectedBranchId, selectedLeadId, subscribeInvalidation, user]);

  useEffect(() => {
    return () => {
      if (leadsRealtimeTimerRef.current) {
        window.clearTimeout(leadsRealtimeTimerRef.current);
      }
      if (detailRealtimeTimerRef.current) {
        window.clearTimeout(detailRealtimeTimerRef.current);
      }
    };
  }, []);

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

    if (!createPurposeKey) {
      toast.error('Follow-up purpose is required');
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
        branchId: createBranchId || undefined,
        followUpPurposeKey: createPurposeKey,
        nextFollowUpAt: nextFollowUpAtIso,
        email: String(createForm.email ?? '').trim() || undefined,
        phone: String(createForm.phone ?? '').trim() || undefined,
        source: String(createForm.source ?? '').trim() || undefined,
        note: String(createForm.note ?? '').trim() || undefined,
        intakeData: Object.keys(intakeData).length > 0 ? intakeData : undefined,
      });

      toast.success(`${dictionary.labels.leadSingular} created`);
      setFormOpen(false);
      setCreateForm(buildInitialForm(dictionary.leadFields, defaultLeadFollowupMinutes));
      setCreateStageKey(sortedStages[0]?.key ?? '');
      setCreatePurposeKey(defaultStagePurposeKey(sortedStages[0]?.key ?? '', sortedStages));
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
      if (!followupPurposeDraft) {
        toast.error('Follow-up purpose is required');
        return;
      }
      await api.patch(`/v1/leads/${selectedLeadDetail.lead.id}/status`, {
        stageKey: stageDraft,
        nextFollowUpAt: nextFollowUpAtIso ?? undefined,
        followUpPurposeKey: followupPurposeDraft,
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

  const downloadLeads = async (): Promise<void> => {
    try {
      const params = new URLSearchParams();

      if (debouncedQuery) {
        params.set('search', debouncedQuery);
      }

      if (stageFilter !== 'ALL') {
        params.set('stageKey', stageFilter);
      }

      if (createdFrom) {
        params.set('createdFrom', new Date(`${createdFrom}T00:00:00`).toISOString());
      }

      if (createdTo) {
        params.set('createdTo', new Date(`${createdTo}T23:59:59.999`).toISOString());
      }

      if (canChooseBranch && branchFilter !== 'ALL') {
        params.set('branchId', branchFilter);
      }

      const response = await api.download(`/v1/leads/export?${params.toString()}`);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
      toast.success(`${dictionary.labels.leadPlural} export downloaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to export ${leadPluralLower}`);
    }
  };

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

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <RefreshButton loading={loading} onClick={loadLeads} className="w-full sm:w-auto" />
          <Button data-tour-id="leads-create-button" onClick={() => setFormOpen((open) => !open)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            {formOpen ? 'Close form' : `New ${leadSingularLower}`}
          </Button>
        </div>
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
                    onChange={(event) => {
                      const nextStageKey = event.target.value;
                      setCreateStageKey(nextStageKey);
                      setCreatePurposeKey(defaultStagePurposeKey(nextStageKey, sortedStages));
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {sortedStages.map((stage) => (
                      <option key={stage.key} value={stage.key}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                </div>
                {canChooseBranch ? (
                  <div className="space-y-2">
                    <Label htmlFor="create-branch">Branch</Label>
                    <select
                      id="create-branch"
                      value={createBranchId}
                      onChange={(event) => setCreateBranchId(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">Select branch</option>
                      {accessibleBranches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="create-purpose">Follow-up purpose</Label>
                  <select
                    id="create-purpose"
                    value={createPurposeKey}
                    onChange={(event) => setCreatePurposeKey(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {stagePurposeOptions(createStageKey, sortedStages).map((purpose) => (
                      <option key={purpose.key} value={purpose.key}>
                        {purpose.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-2xl border border-white/70 bg-background/70 p-3 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Purpose guidance</p>
                  <p className="mt-1">
                    {stageFollowupGuidance(createStageKey, sortedStages) ?? 'Choose the business reason for this follow-up.'}
                  </p>
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
                    {intakeFields.map((field) => {
                      const optionsOverride =
                        dictionary.preset === 'DOCTOR_OPD_CLINIC' && field.key === 'departmentOrSpeciality'
                          ? opdDepartmentOptions
                          : dictionary.preset === 'DOCTOR_OPD_CLINIC' && field.key === 'preferredDoctor'
                            ? opdDoctorOptions
                            : undefined;
                      const disabled =
                        dictionary.preset === 'DOCTOR_OPD_CLINIC' && field.key === 'preferredDoctor'
                          ? !selectedDepartmentId || opdDoctorOptions.length === 0
                          : false;

                      return renderField(
                        field,
                        createForm[field.key],
                        (next) => {
                          setCreateForm((prev) => {
                            const nextState = { ...prev, [field.key]: next };
                            if (dictionary.preset === 'DOCTOR_OPD_CLINIC' && field.key === 'departmentOrSpeciality') {
                              nextState.preferredDoctor = '';
                            }
                            return nextState;
                          });
                        },
                        optionsOverride,
                        disabled,
                      );
                    })}
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

      <Card data-tour-id="leads-list" className="rounded-3xl border-white/80 bg-card/95">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                data-tour-id="leads-search"
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
            {canChooseBranch ? (
              <select
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm lg:w-auto"
              >
                <option value="ALL">All branches</option>
                {accessibleBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            ) : null}
            <Input
              type="date"
              value={createdFrom}
              onChange={(event) => setCreatedFrom(event.target.value)}
              className="h-10 w-full lg:w-auto"
            />
            <Input
              type="date"
              value={createdTo}
              onChange={(event) => setCreatedTo(event.target.value)}
              className="h-10 w-full lg:w-auto"
            />
            <Button variant="outline" onClick={() => void downloadLeads()} className="w-full lg:w-auto">
              Download CSV
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <p className="font-semibold">No {leadPluralLower} found</p>
              <p className="mt-1 text-sm text-muted-foreground">{dictionary.labels.emptyLeads}</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {leads.map((lead) => (
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
                      {canChooseBranch ? (
                        <p>
                          <span className="font-medium text-foreground">Branch:</span>{' '}
                          {lead.branchId ? (branchNameById.get(lead.branchId) ?? 'Unknown branch') : 'Unassigned'}
                        </p>
                      ) : null}
                      <p>
                        <span className="font-medium text-foreground">{dictionary.labels.followupLabel}:</span>{' '}
                        {lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleString() : 'N/A'}
                      </p>
                      {intakeSummaryFields[0] ? (
                        <p>
                          <span className="font-medium text-foreground">{intakeSummaryFields[0].label}:</span>{' '}
                          {intakeValue(lead, intakeSummaryFields[0].key)}
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
                      {canChooseBranch ? <TableHead>Branch</TableHead> : null}
                      <TableHead>{dictionary.labels.stageLabel}</TableHead>
                      <TableHead>{dictionary.labels.followupLabel}</TableHead>
                      <TableHead>Contact</TableHead>
                      {intakeSummaryFields.map((field) => (
                        <TableHead key={field.key}>{field.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((lead) => (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedLeadId(lead.id)}
                      >
                        <TableCell className="font-semibold">{lead.name}</TableCell>
                        {canChooseBranch ? (
                          <TableCell>{lead.branchId ? (branchNameById.get(lead.branchId) ?? 'Unknown branch') : 'Unassigned'}</TableCell>
                        ) : null}
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
                        {intakeSummaryFields.map((field) => (
                          <TableCell key={field.key}>{intakeValue(lead, field.key)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-2 border-t border-white/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-
                  {total === 0 ? 0 : Math.min(page * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={loading || page <= 1}
                  >
                    Previous
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={loading || page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
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
                    onChange={(event) => {
                      const nextStageKey = event.target.value;
                      setStageDraft(nextStageKey);
                      setFollowupPurposeDraft(defaultStagePurposeKey(nextStageKey, sortedStages));
                    }}
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

                  <div className="space-y-2">
                    <Label htmlFor="next-followup-purpose">Follow-up purpose</Label>
                    <select
                      id="next-followup-purpose"
                      value={followupPurposeDraft}
                      onChange={(event) => setFollowupPurposeDraft(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {stagePurposeOptions(stageDraft || inferStageKey(selectedLeadDetail.lead, sortedStages), sortedStages).map((purpose) => (
                        <option key={purpose.key} value={purpose.key}>
                          {purpose.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {stageFollowupGuidance(stageDraft || inferStageKey(selectedLeadDetail.lead, sortedStages), sortedStages)
                        ?? 'Choose the business reason for the next follow-up.'}
                    </p>
                  </div>

                  <Button onClick={() => void updateStatus()} className="w-full">
                    Save stage
                  </Button>
                </CardContent>
              </Card>

              {selectedLeadDetail.followUps.some((followUp) => followUp.kind === 'POST_REPORT') ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{dictionary.labels.reportLabel} Workflow</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      Current stage:{' '}
                      <span className="font-semibold">{stageLabel(inferStageKey(selectedLeadDetail.lead, sortedStages), sortedStages)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      Post-{dictionary.labels.reportLabel.toLowerCase()} {dictionary.labels.followupLabel.toLowerCase()} tasks are surfaced as first-class items when that milestone is reached.
                    </p>
                    <div className="space-y-2">
                      {selectedLeadDetail.followUps
                        .filter((followUp) => followUp.kind === 'POST_REPORT')
                        .map((followUp) => (
                          <div key={followUp.id} className="rounded-md border bg-accent/40 p-3">
                            <p className="font-medium">{followupPurposeLabel(followUp, sortedStages)}</p>
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
                          <p className="mt-1 text-sm text-foreground">{followupPurposeLabel(followUp, sortedStages)}</p>
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
