import type {
  IndustryPreset,
  LeadFieldConfig,
  LeadStatus,
  PipelineStage,
  TenantProfile,
} from '@leadops/shared';

export interface UiDictionary {
  tenantName: string;
  tenantSlug: string;
  preset: IndustryPreset;
  labels: TenantProfile['displayConfig']['vocabulary'];
  dashboardCards: TenantProfile['displayConfig']['dashboardConfig']['cards'];
  leadFields: LeadFieldConfig[];
  pipelineStages: PipelineStage[];
  featureFlags: Record<string, boolean>;
  theme: TenantProfile['displayConfig']['themeConfig'];
  isDiagnosticsLab: boolean;
}

const GENERIC_FALLBACK: TenantProfile = {
  tenantId: 'fallback-generic',
  tenantName: 'Tenant',
  tenantSlug: 'tenant',
  configVersion: 1,
  industryPreset: 'GENERIC' as IndustryPreset,
  displayConfig: {
    vocabulary: {
      leadSingular: 'Lead',
      leadPlural: 'Leads',
      leadCreateTitle: 'Create lead',
      dashboardTitle: 'Owner Dashboard',
      todayFollowupsTitle: "Today's Follow-ups",
      bookingLabel: 'Won',
      reportLabel: 'Report',
      stageLabel: 'Stage',
      followupLabel: 'Follow-up',
      sidebarSubtitle: 'LeadOps',
      emptyLeads: 'No leads found.',
      emptyFollowups: 'No follow-ups due right now.',
      statusLabels: {
        NEW: 'New',
        CONTACTED: 'Contacted',
        QUALIFIED: 'Qualified',
        PENDING: 'Pending',
        WON: 'Won',
        LOST: 'Lost',
      },
    },
    dashboardConfig: {
      cards: [
        { key: 'new', label: 'New', metricKey: 'new', icon: 'sparkles' },
        { key: 'pending', label: 'Pending', metricKey: 'pending', icon: 'circle-dashed' },
        { key: 'missed', label: 'Missed', metricKey: 'missed', icon: 'circle-off' },
        { key: 'won', label: 'Won', metricKey: 'won', icon: 'trophy' },
        { key: 'lost', label: 'Lost', metricKey: 'lost', icon: 'bar-chart' },
        {
          key: 'avgResponseMinutes',
          label: 'Avg First Response Time',
          metricKey: 'avgResponseMinutes',
          icon: 'clock',
        },
      ],
    },
    leadFieldsConfig: {
      fields: [
        { key: 'name', label: 'Lead name', type: 'text', required: true, section: 'core' },
        { key: 'nextFollowUpAt', label: 'Next follow-up', type: 'datetime', required: true, section: 'core' },
        { key: 'email', label: 'Email', type: 'email', required: false, section: 'core' },
        { key: 'phone', label: 'Phone', type: 'phone', required: false, section: 'core' },
        { key: 'note', label: 'Initial note', type: 'textarea', required: false, section: 'core' },
      ],
    },
    pipelineConfig: {
      stages: [
        {
          key: 'NEW',
          label: 'New',
          internalStatus: 'NEW' as LeadStatus,
          allowedNext: ['CONTACTED', 'LOST'],
          terminal: false,
          order: 0,
        },
        {
          key: 'CONTACTED',
          label: 'Contacted',
          internalStatus: 'CONTACTED' as LeadStatus,
          allowedNext: ['QUALIFIED', 'PENDING', 'LOST'],
          terminal: false,
          order: 1,
        },
        {
          key: 'QUALIFIED',
          label: 'Qualified',
          internalStatus: 'QUALIFIED' as LeadStatus,
          allowedNext: ['PENDING', 'WON', 'LOST'],
          terminal: false,
          order: 2,
        },
        {
          key: 'PENDING',
          label: 'Pending',
          internalStatus: 'PENDING' as LeadStatus,
          allowedNext: ['WON', 'LOST'],
          terminal: false,
          order: 3,
        },
        {
          key: 'WON',
          label: 'Won',
          internalStatus: 'WON' as LeadStatus,
          allowedNext: [],
          terminal: true,
          order: 4,
        },
        {
          key: 'LOST',
          label: 'Lost',
          internalStatus: 'LOST' as LeadStatus,
          allowedNext: [],
          terminal: true,
          order: 5,
        },
      ],
    },
    followupRules: {
      firstReminderMinutes: 30,
      escalationMinutes: 120,
      postReportFollowupDays: 3,
      postReportFollowupNote: 'Post-report follow-up call',
    },
    themeConfig: {
      accentColor: '#2f90b7',
      sidebarTitle: 'LeadOps',
    },
    featureFlags: {
      aiAssist: true,
    },
  },
};

export function createFallbackTenantProfile(tenantName = 'Tenant'): TenantProfile {
  return {
    ...GENERIC_FALLBACK,
    tenantName,
  };
}

export function buildUiDictionary(profile?: TenantProfile | null): UiDictionary {
  const active = profile ?? GENERIC_FALLBACK;

  return {
    tenantName: active.tenantName,
    tenantSlug: active.tenantSlug,
    preset: active.industryPreset,
    labels: active.displayConfig.vocabulary,
    dashboardCards: active.displayConfig.dashboardConfig.cards,
    leadFields: active.displayConfig.leadFieldsConfig.fields,
    pipelineStages: active.displayConfig.pipelineConfig.stages,
    featureFlags: active.displayConfig.featureFlags,
    theme: active.displayConfig.themeConfig,
    isDiagnosticsLab: active.industryPreset === ('DIAGNOSTICS_LAB' as IndustryPreset),
  };
}
