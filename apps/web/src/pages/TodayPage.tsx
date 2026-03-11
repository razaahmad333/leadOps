import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Search } from 'lucide-react';
import type { TodayFollowUp } from '@leadops/shared';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useTenant } from '../context/TenantContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

function followupKindLabel(kind: string): string {
  if (kind === 'POST_REPORT') {
    return 'Post-Report';
  }

  return kind.replace('_', ' ');
}

export function TodayPage(): React.JSX.Element {
  const { dictionary, profile } = useTenant();
  const [followUps, setFollowUps] = useState<TodayFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = (): void => {
    setLoading(true);
    api
      .get<TodayFollowUp[]>('/v1/followups/today')
      .then(setFollowUps)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load follow-ups');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [profile?.tenantId]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return followUps;
    }

    return followUps.filter((item) => item.lead.name.toLowerCase().includes(normalized));
  }, [followUps, query]);

  const markDone = async (id: string): Promise<void> => {
    try {
      await api.patch(`/v1/followups/${id}/done`, {});
      toast.success(`${dictionary.labels.followupLabel} marked done`);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Update failed');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2 pt-2 sm:pt-3">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Daily Queue</p>
          <h1 className="text-2xl font-bold">{dictionary.labels.todayFollowupsTitle}</h1>
          <p className="text-sm text-muted-foreground">
            Ensure every active {dictionary.labels.leadSingular.toLowerCase()} gets timely attention.
          </p>
        </div>
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Filter by ${dictionary.labels.leadSingular.toLowerCase()} name`}
            className="pl-9"
          />
        </div>
      </div>

      <Card className="rounded-3xl border-white/80 bg-card/95">
        <CardHeader>
          <CardTitle>Due Queue</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <p className="font-semibold">{dictionary.labels.emptyFollowups}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You are caught up. New reminders will appear here automatically.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {filtered.map((followUp) => (
                  <div key={followUp.id} className="rounded-2xl border border-white/70 bg-background/70 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{followUp.lead.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{followUp.lead.phone ?? 'No phone'}</p>
                      </div>
                      <Badge variant={followUp.kind === 'POST_REPORT' ? 'warning' : 'secondary'}>
                        {followupKindLabel(followUp.kind)}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      <p>{new Date(followUp.scheduledAt).toLocaleString()}</p>
                      <p>{followUp.assignedUser?.name ?? 'Unassigned'}</p>
                    </div>
                    <Button size="sm" className="mt-4 w-full" onClick={() => void markDone(followUp.id)}>
                      <CheckCircle2 className="h-4 w-4" />
                      Mark done
                    </Button>
                  </div>
                ))}
              </div>

              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{dictionary.labels.leadSingular}</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((followUp) => (
                      <TableRow key={followUp.id}>
                        <TableCell className="font-semibold">{followUp.lead.name}</TableCell>
                        <TableCell>{followUp.lead.phone ?? 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={followUp.kind === 'POST_REPORT' ? 'warning' : 'secondary'}>
                            {followupKindLabel(followUp.kind)}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(followUp.scheduledAt).toLocaleString()}</TableCell>
                        <TableCell>{followUp.assignedUser?.name ?? 'Unassigned'}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" onClick={() => void markDone(followUp.id)}>
                            <CheckCircle2 className="h-4 w-4" />
                            Mark done
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
