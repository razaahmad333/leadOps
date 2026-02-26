import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Search } from 'lucide-react';
import type { TodayFollowUp } from '@leadops/shared';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

export function TodayPage(): React.JSX.Element {
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
  }, []);

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
      toast.success('Follow-up marked done');
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Update failed');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Today's Follow-ups</h1>
          <p className="text-sm text-muted-foreground">Ensure every active lead gets timely attention.</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by lead name"
            className="pl-9"
          />
        </div>
      </div>

      <Card>
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
              <p className="font-semibold">No follow-ups due right now.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You are caught up. New reminders will appear here automatically.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Phone</TableHead>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
