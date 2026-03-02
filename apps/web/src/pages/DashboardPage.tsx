import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  CircleDashed,
  CircleOff,
  ClipboardCheck,
  Clock3,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { DashboardMetricKey, DashboardStats } from '@leadops/shared';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useTenant } from '../context/TenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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

export function DashboardPage(): React.JSX.Element {
  const { dictionary, profile } = useTenant();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<DashboardStats>('/v1/dashboard/stats')
      .then(setStats)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load dashboard');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [profile?.tenantId]);

  const subtitle = useMemo(() => {
    if (dictionary.isDiagnosticsLab) {
      return 'Monitor enquiry velocity, booking conversion, and post-report follow-up health.';
    }

    return 'Real-time summary across tenant pipeline health.';
  }, [dictionary.isDiagnosticsLab]);

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden border-white/80 bg-card/90">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Operations</p>
              <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{dictionary.labels.dashboardTitle}</h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
              <div className="rounded-2xl border border-white/70 bg-background/80 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Cards</p>
                <p className="mt-2 text-xl font-semibold">{dictionary.dashboardCards.length}</p>
              </div>
              <div className="rounded-2xl border border-white/70 bg-background/80 p-3">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Preset</p>
                <p className="mt-2 text-sm font-semibold">
                  {dictionary.isDiagnosticsLab ? 'Diagnostics Lab' : 'Generic'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="rounded-3xl border-white/70">
              <CardContent className="space-y-3 p-5 sm:p-6">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {dictionary.dashboardCards.map((card) => {
            const Icon = card.icon ? ICONS[card.icon] ?? BarChart3 : BarChart3;
            const value = metricValue(stats, card.metricKey);

            return (
              <Card key={card.key} className="rounded-3xl border-white/70 bg-card/95">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </span>
                    {card.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold sm:text-4xl">{formatMetric(card.metricKey, value)}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
