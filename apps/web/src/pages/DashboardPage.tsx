import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  CircleHelp,
  CircleDashed,
  CircleOff,
  ClipboardCheck,
  Clock3,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { REALTIME_INVALIDATION_EVENTS } from '@leadops/shared';
import type {
  DashboardAnalytics,
  DashboardBreakdownItem,
  DashboardMetricKey,
  DashboardStats,
  DashboardTrendPoint,
} from '@leadops/shared';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useTenant } from '../context/TenantContext';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { buildBranchOptions, resolveBranchScopeLabel } from '../lib/branch-scope';
import { industryPresetLabel } from '../lib/industry-preset';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sparkles: Sparkles,
  'circle-dashed': CircleDashed,
  'circle-off': CircleOff,
  trophy: Trophy,
  'bar-chart': BarChart3,
  clock: Clock3,
  activity: Activity,
  'clipboard-check': ClipboardCheck,
};

const CHART_COLORS = {
  primary: '#0f766e',
  secondary: '#f59e0b',
  tertiary: '#2563eb',
  neutral: '#94a3b8',
  rose: '#e11d48',
} as const;
const COMPARISON_PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.tertiary,
  CHART_COLORS.rose,
  '#7c3aed',
  '#14b8a6',
] as const;

function metricValue(stats: DashboardStats | null, key: DashboardMetricKey): number {
  if (!stats) {
    return 0;
  }

  return stats[key] ?? 0;
}

function formatMetric(key: DashboardMetricKey, value: number): string {
  if (key === 'avgResponseMinutes') {
    return `${value} min`;
  }

  return value.toLocaleString();
}

function EmptyChart({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-white/70 bg-background/60 px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function InfoHint(props: {
  label: string;
  helpText: string;
  align?: 'left' | 'right';
}): React.JSX.Element {
  const { label, helpText, align = 'right' } = props;

  return (
    <div className="group relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        title={helpText}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/80 bg-background/90 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      <div
        className={`pointer-events-none absolute top-8 z-20 hidden w-64 rounded-2xl border border-white/80 bg-background/95 p-3 text-xs leading-5 text-muted-foreground shadow-xl group-hover:block group-focus-within:block ${
          align === 'left' ? 'left-0' : 'right-0'
        }`}
      >
        {helpText}
      </div>
    </div>
  );
}

function metricHelpText(
  key: DashboardMetricKey,
  input: {
    leadSingular: string;
    leadPlural: string;
    bookingLabel: string;
    followupLabel: string;
    reportLabel: string;
  },
): string {
  const leadSingular = input.leadSingular.toLowerCase();
  const leadPlural = input.leadPlural.toLowerCase();
  const bookingLabel = input.bookingLabel.toLowerCase();
  const followupPlural = `${input.followupLabel.toLowerCase()}s`;
  const reportLabel = input.reportLabel.toLowerCase();

  switch (key) {
    case 'new':
      return `Current ${leadPlural} in the New status for the visible branch scope.`;
    case 'pending':
      return `Current ${leadPlural} in the Pending status for the visible branch scope.`;
    case 'missed':
      return `Current ${leadPlural} in the Lost status for the visible branch scope.`;
    case 'won':
      return `Current ${leadPlural} in the Won status for the visible branch scope.`;
    case 'lost':
      return `Current ${leadPlural} in the Lost status for the visible branch scope.`;
    case 'avgResponseMinutes':
      return `Average minutes between ${leadSingular} creation and the first follow-up being created.`;
    case 'enquiriesToday':
      return `${input.leadPlural} created today in the visible branch scope.`;
    case 'bookingsToday':
      return `${input.leadPlural} moved into ${bookingLabel} today in the visible branch scope.`;
    case 'pendingFollowups':
      return `All unfinished ${followupPlural} in the visible scope, including future-scheduled items that may not appear in the Due Queue yet.`;
    case 'missedFollowups':
      return `Unfinished ${followupPlural} scheduled before now in the visible scope.`;
    case 'postReportFollowupsDue':
      return `Open post-${reportLabel} ${followupPlural} already due in the visible scope.`;
    default:
      return 'Current dashboard metric for the visible branch scope.';
  }
}

function chartHelpText(
  key: 'trend' | 'pipeline' | 'health' | 'comparison',
  input: {
    leadPlural: string;
    followupLabel: string;
  },
): string {
  const leadPlural = input.leadPlural.toLowerCase();
  const followupPlural = `${input.followupLabel.toLowerCase()}s`;

  switch (key) {
    case 'trend':
      return `Fourteen-day time series for daily ${leadPlural} intake, conversion activity, and completed ${followupPlural}.`;
    case 'pipeline':
      return `Snapshot of where current ${leadPlural} sit in the visible pipeline right now. This is not limited to today's intake.`;
    case 'health':
      return `Operational split of ${followupPlural} into overdue, escalated, due today, and completed today.`;
    case 'comparison':
      return 'Current workload comparison for the visible scope. Depending on branch scope, this shows either branch comparison or source mix.';
    default:
      return 'Current dashboard chart for the visible scope.';
  }
}

function ChartCard(props: {
  title: string;
  description: string;
  helpText?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { title, description, helpText, children } = props;

  return (
    <Card className="rounded-3xl border-white/70 bg-card/95">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          {helpText ? <InfoHint label={`${title} info`} helpText={helpText} /> : null}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function LegendChip(props: {
  color: string;
  label: string;
}): React.JSX.Element {
  const { color, label } = props;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-background/80 px-3 py-1 text-xs font-medium">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </div>
  );
}

function TrendChart({ trend }: { trend: DashboardAnalytics['trend'] }): React.JSX.Element {
  if (trend.points.length === 0) {
    return <EmptyChart message="No trend data available yet." />;
  }

  const width = 680;
  const height = 260;
  const left = 34;
  const right = 14;
  const top = 18;
  const bottom = 38;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(
    1,
    ...trend.points.flatMap((point: DashboardTrendPoint) => [point.primary, point.secondary, point.tertiary]),
  );

  const xFor = (index: number): number => {
    if (trend.points.length === 1) {
      return left + chartWidth / 2;
    }

    return left + (index / (trend.points.length - 1)) * chartWidth;
  };

  const yFor = (value: number): number => top + (1 - value / maxValue) * chartHeight;

  const buildSeriesPath = (points: DashboardTrendPoint[], key: 'primary' | 'secondary' | 'tertiary'): string =>
    points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index).toFixed(2)} ${yFor(point[key]).toFixed(2)}`)
      .join(' ');

  const tickValues = Array.from({ length: 4 }, (_, index) => Math.round((maxValue / 3) * index)).reverse();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <LegendChip color={CHART_COLORS.primary} label={trend.primaryLabel} />
        <LegendChip color={CHART_COLORS.secondary} label={trend.secondaryLabel} />
        <LegendChip color={CHART_COLORS.tertiary} label={trend.tertiaryLabel} />
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
        {tickValues.map((value) => {
          const y = yFor(value);
          return (
            <g key={value}>
              <line x1={left} y1={y} x2={width - right} y2={y} stroke="#e2e8f0" strokeDasharray="4 6" />
              <text x={left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                {value}
              </text>
            </g>
          );
        })}

        <path d={buildSeriesPath(trend.points, 'primary')} fill="none" stroke={CHART_COLORS.primary} strokeWidth="3" />
        <path d={buildSeriesPath(trend.points, 'secondary')} fill="none" stroke={CHART_COLORS.secondary} strokeWidth="3" />
        <path d={buildSeriesPath(trend.points, 'tertiary')} fill="none" stroke={CHART_COLORS.tertiary} strokeWidth="3" />

        {trend.points.map((point: DashboardTrendPoint, index: number) => (
          <g key={point.date}>
            <circle cx={xFor(index)} cy={yFor(point.primary)} r="3.5" fill={CHART_COLORS.primary} />
            <circle cx={xFor(index)} cy={yFor(point.secondary)} r="3.5" fill={CHART_COLORS.secondary} />
            <circle cx={xFor(index)} cy={yFor(point.tertiary)} r="3.5" fill={CHART_COLORS.tertiary} />
            <text
              x={xFor(index)}
              y={height - 12}
              textAnchor="middle"
              fontSize="10"
              fill="#64748b"
            >
              {index % 2 === 0 || index === trend.points.length - 1 ? point.label : ''}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function BreakdownChart(props: {
  items: DashboardBreakdownItem[];
  emptyMessage: string;
}): React.JSX.Element {
  const { items, emptyMessage } = props;

  if (items.length === 0) {
    return <EmptyChart message={emptyMessage} />;
  }

  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.key} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="font-medium text-foreground">{item.label}</p>
            <p className="text-muted-foreground">{item.value.toLocaleString()}</p>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#0f766e,#14b8a6)]"
              style={{ width: `${Math.max((item.value / maxValue) * 100, 4)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function FollowupHealthChart({ items }: { items: DashboardBreakdownItem[] }): React.JSX.Element {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const colorByKey: Record<string, string> = {
    overdue: CHART_COLORS.rose,
    escalated: '#7c3aed',
    'due-today': CHART_COLORS.secondary,
    'completed-today': CHART_COLORS.primary,
  };

  if (total === 0) {
    return <EmptyChart message="No follow-up activity is available for the current scope." />;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Queue Snapshot</p>
            <p className="text-3xl font-bold">{total.toLocaleString()}</p>
          </div>
          <Badge variant="outline" className="rounded-full border-white/70 bg-background/90 px-3 py-1">
            Today + backlog
          </Badge>
        </div>
        <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
          {items.map((item, index) => (
            <div
              key={item.key}
              className="h-full"
              style={{
                width: `${(item.value / total) * 100}%`,
                backgroundColor: colorByKey[item.key] ?? COMPARISON_PIE_COLORS[index % COMPARISON_PIE_COLORS.length],
              }}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item, index) => (
          <div key={item.key} className="rounded-2xl border border-white/70 bg-background/70 p-4">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colorByKey[item.key] ?? COMPARISON_PIE_COLORS[index % COMPARISON_PIE_COLORS.length] }}
              />
              <p className="text-sm font-medium">{item.label}</p>
            </div>
            <p className="mt-2 text-2xl font-semibold">{item.value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              {Math.round((item.value / total) * 100)}% of visible follow-up activity
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonBar(props: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}): React.JSX.Element {
  const { label, value, maxValue, color } = props;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{value.toLocaleString()}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full"
          style={{
            width: `${maxValue === 0 ? 0 : Math.max((value / maxValue) * 100, value > 0 ? 4 : 0)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number): { x: number; y: number } {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    'Z',
  ].join(' ');
}

function SourceMixPieChart({ comparison }: { comparison: DashboardAnalytics['comparison'] }): React.JSX.Element {
  const items = comparison.items.slice(0, 6);

  if (items.length === 0) {
    return <EmptyChart message="No source mix data is available for the current scope." />;
  }

  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
    return <EmptyChart message="No source mix data is available for the current scope." />;
  }

  const radius = 76;
  const center = 96;
  let startAngle = 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center">
      <div className="mx-auto w-full max-w-[220px]">
        <svg viewBox="0 0 192 192" className="w-full">
          {items.map((item, index) => {
            const angle = (item.value / total) * 360;
            const endAngle = startAngle + angle;
            const path = describeArc(center, center, radius, startAngle, endAngle);
            const segment = (
              <path
                key={item.key}
                d={path}
                fill={COMPARISON_PIE_COLORS[index % COMPARISON_PIE_COLORS.length]}
                stroke="#ffffff"
                strokeWidth="3"
              />
            );
            startAngle = endAngle;
            return segment;
          })}
          <circle cx={center} cy={center} r="42" fill="#ffffff" />
          <text x={center} y={center - 4} textAnchor="middle" fontSize="11" fill="#64748b">
            Total
          </text>
          <text x={center} y={center + 20} textAnchor="middle" fontSize="22" fontWeight="700" fill="#0f172a">
            {total.toLocaleString()}
          </text>
        </svg>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => {
          const percent = Math.round((item.value / total) * 100);
          return (
            <div key={item.key} className="rounded-2xl border border-white/70 bg-background/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: COMPARISON_PIE_COLORS[index % COMPARISON_PIE_COLORS.length] }}
                  />
                  <p className="truncate font-semibold">{item.label}</p>
                </div>
                <p className="shrink-0 text-sm text-muted-foreground">{percent}%</p>
              </div>
              <p className="mt-2 text-2xl font-semibold">{item.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{comparison.primaryLabel}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComparisonChart({ comparison }: { comparison: DashboardAnalytics['comparison'] }): React.JSX.Element {
  if (comparison.kind === 'source') {
    return <SourceMixPieChart comparison={comparison} />;
  }

  const items = comparison.items.slice(0, 6);
  if (items.length === 0) {
    return <EmptyChart message="No comparison data is available for the current scope." />;
  }

  const maxPrimary = Math.max(...items.map((item: DashboardAnalytics['comparison']['items'][number]) => item.value), 1);
  const maxSecondary = Math.max(
    ...items.map((item: DashboardAnalytics['comparison']['items'][number]) => item.secondaryValue ?? 0),
    1,
  );

  return (
    <div className="space-y-4">
      {items.map((item: DashboardAnalytics['comparison']['items'][number]) => (
        <div key={item.key} className="rounded-2xl border border-white/70 bg-background/70 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-semibold">{item.label}</p>
            <p className="text-xs text-muted-foreground">
              {item.value.toLocaleString()}
              {comparison.secondaryLabel ? ` / ${(item.secondaryValue ?? 0).toLocaleString()}` : ''}
            </p>
          </div>
          <div className="space-y-3">
            <ComparisonBar
              label={comparison.primaryLabel}
              value={item.value}
              maxValue={maxPrimary}
              color={CHART_COLORS.primary}
            />
            {comparison.secondaryLabel ? (
              <ComparisonBar
                label={comparison.secondaryLabel}
                value={item.secondaryValue ?? 0}
                maxValue={maxSecondary}
                color={CHART_COLORS.secondary}
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardPage(): React.JSX.Element {
  const { dictionary, profile } = useTenant();
  const { user, selectedBranchId } = useAuth();
  const { subscribeInvalidation } = useRealtime();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [realtimeVersion, setRealtimeVersion] = useState(0);
  const realtimeTimerRef = useRef<number | null>(null);

  const branchOptions = useMemo(() => buildBranchOptions(user), [user]);
  const branchScopeLabel = useMemo(
    () => resolveBranchScopeLabel(branchOptions, selectedBranchId),
    [branchOptions, selectedBranchId],
  );

  useEffect(() => {
    setLoading(true);
    api
      .get<DashboardStats>('/v1/dashboard/stats')
      .then(setStats)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load dashboard');
        setStats(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [profile?.tenantId, realtimeVersion, selectedBranchId]);

  useEffect(() => {
    return subscribeInvalidation((event) => {
      if (!user || event.tenantId !== user.tenantId) {
        return;
      }

      if (
        event.event !== REALTIME_INVALIDATION_EVENTS.LEADS_INVALIDATE
        && event.event !== REALTIME_INVALIDATION_EVENTS.TODAY_INVALIDATE
      ) {
        return;
      }

      if (selectedBranchId && event.branchId && event.branchId !== selectedBranchId) {
        return;
      }

      if (realtimeTimerRef.current) {
        window.clearTimeout(realtimeTimerRef.current);
      }

      realtimeTimerRef.current = window.setTimeout(() => {
        setRealtimeVersion((current) => current + 1);
      }, 250);
    });
  }, [selectedBranchId, subscribeInvalidation, user]);

  useEffect(() => {
    return () => {
      if (realtimeTimerRef.current) {
        window.clearTimeout(realtimeTimerRef.current);
      }
    };
  }, []);

  const subtitle = useMemo(() => {
    return `Review branch-aware ${dictionary.labels.leadPlural.toLowerCase()} flow, ${dictionary.labels.bookingLabel.toLowerCase()} momentum, and follow-up load in one operational view.`;
  }, [dictionary.labels.bookingLabel, dictionary.labels.leadPlural]);

  const dashboardCardHelp = useMemo(
    () =>
      new Map(
        dictionary.dashboardCards.map((card) => [
          card.key,
          metricHelpText(card.metricKey, {
            leadSingular: dictionary.labels.leadSingular,
            leadPlural: dictionary.labels.leadPlural,
            bookingLabel: dictionary.labels.bookingLabel,
            followupLabel: dictionary.labels.followupLabel,
            reportLabel: dictionary.labels.reportLabel,
          }),
        ]),
      ),
    [
      dictionary.dashboardCards,
      dictionary.labels.bookingLabel,
      dictionary.labels.followupLabel,
      dictionary.labels.leadPlural,
      dictionary.labels.leadSingular,
      dictionary.labels.reportLabel,
    ],
  );

  return (
    <div className="space-y-5">
      <Card data-tour-id="dashboard-overview" className="overflow-hidden border-white/80 bg-card/90">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Operations</p>
              <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{dictionary.labels.dashboardTitle}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:max-w-2xl">
              <div className="rounded-2xl border border-white/70 bg-background/80 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Cards</p>
                <p className="mt-2 text-xl font-semibold">{dictionary.dashboardCards.length}</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-background/80 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Scope</p>
                <p className="mt-2 text-sm font-semibold">{branchScopeLabel}</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-background/80 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Preset</p>
                <p className="mt-2 text-sm font-semibold">
                  {industryPresetLabel(profile?.industryPreset)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: dictionary.dashboardCards.length }).map((_, index) => (
              <Card key={index} className="rounded-3xl border-white/70">
                <CardContent className="space-y-3 p-5 sm:p-6">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="rounded-3xl border-white/70">
                <CardHeader>
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-56" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-48 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {dictionary.dashboardCards.map((card) => {
              const Icon = card.icon ? ICONS[card.icon] ?? BarChart3 : BarChart3;
              const value = metricValue(stats, card.metricKey);

              return (
                <Card key={card.key} className="rounded-3xl border-white/70 bg-card/95">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </span>
                        {card.label}
                      </CardTitle>
                      <InfoHint
                        label={`${card.label} info`}
                        helpText={dashboardCardHelp.get(card.key) ?? 'Current dashboard metric for the visible scope.'}
                        align="left"
                      />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold sm:text-4xl">{formatMetric(card.metricKey, value)}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="14-Day Trend"
              description="Daily activity for lead intake, conversion, and completed follow-up work."
              helpText={chartHelpText('trend', {
                leadPlural: dictionary.labels.leadPlural,
                followupLabel: dictionary.labels.followupLabel,
              })}
            >
              <TrendChart trend={stats?.analytics.trend ?? { primaryLabel: '', secondaryLabel: '', tertiaryLabel: '', points: [] }} />
            </ChartCard>

            <ChartCard
              title={stats?.analytics.pipelineBreakdown.title ?? 'Pipeline Breakdown'}
              description="Shows the current stage distribution across the visible pipeline, not today’s intake."
              helpText={chartHelpText('pipeline', {
                leadPlural: dictionary.labels.leadPlural,
                followupLabel: dictionary.labels.followupLabel,
              })}
            >
              <BreakdownChart
                items={stats?.analytics.pipelineBreakdown.items ?? []}
                emptyMessage="No pipeline distribution data is available yet."
              />
            </ChartCard>

            <ChartCard
              title="Follow-up Health"
              description="Separate overdue work, escalated follow-ups, today’s due load, and completed actions."
              helpText={chartHelpText('health', {
                leadPlural: dictionary.labels.leadPlural,
                followupLabel: dictionary.labels.followupLabel,
              })}
            >
              <FollowupHealthChart items={stats?.analytics.followupHealth.items ?? []} />
            </ChartCard>

            <ChartCard
              title={stats?.analytics.comparison.title ?? 'Comparison'}
              description={
                stats?.analytics.comparison.kind === 'branch'
                  ? 'Compare visible branches by current workload and pending follow-ups.'
                  : 'See which sources are driving the current scoped pipeline.'
              }
              helpText={chartHelpText('comparison', {
                leadPlural: dictionary.labels.leadPlural,
                followupLabel: dictionary.labels.followupLabel,
              })}
            >
              <ComparisonChart
                comparison={
                  stats?.analytics.comparison ?? {
                    kind: 'source',
                    title: 'Source Mix',
                    primaryLabel: dictionary.labels.leadPlural,
                    items: [],
                  }
                }
              />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
