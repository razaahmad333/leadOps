import React, { useEffect, useState } from 'react';
import { BarChart3, Clock3, CircleDashed, CircleOff, Sparkles, Trophy } from 'lucide-react';
import type { DashboardStats } from '@leadops/shared';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Skeleton } from '../components/ui/skeleton';

const CARD_META: Array<{ key: keyof DashboardStats; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'new', label: 'New', icon: Sparkles },
  { key: 'pending', label: 'Pending', icon: CircleDashed },
  { key: 'missed', label: 'Missed', icon: CircleOff },
  { key: 'won', label: 'Won', icon: Trophy },
  { key: 'lost', label: 'Lost', icon: BarChart3 },
  { key: 'avgResponseMinutes', label: 'Response (min)', icon: Clock3 },
];

export function DashboardPage(): React.JSX.Element {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DashboardStats>('/v1/dashboard/stats')
      .then(setStats)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load dashboard');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Owner Dashboard</h1>
        <p className="text-sm text-muted-foreground">Real-time summary across tenant pipeline health.</p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 p-6">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {CARD_META.map((item) => {
            const Icon = item.icon;
            const value = stats?.[item.key] ?? 0;

            return (
              <Card key={item.key} className="bg-card/95">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4 w-4 text-primary" />
                    {item.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
