import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Search } from 'lucide-react';
import {
  REALTIME_INVALIDATION_EVENTS,
  type Branch,
  type TodayFollowUp,
  type TodayFollowUpListResponse,
} from '@leadops/shared';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useRealtime } from '../context/RealtimeContext';
import { useTenant } from '../context/TenantContext';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import { buildAccessibleBranches, resolveBranchFilterValue } from '../lib/branch-scope';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

const PAGE_SIZE = 20;

function followupKindLabel(kind: string): string {
  if (kind === 'POST_REPORT') {
    return 'Post-Report';
  }

  return kind.replace('_', ' ');
}

export function TodayPage(): React.JSX.Element {
  const { user, selectedBranchId } = useAuth();
  const { subscribeInvalidation } = useRealtime();
  const { dictionary, profile } = useTenant();
  const [followUps, setFollowUps] = useState<TodayFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), 350);
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [includeOverdue, setIncludeOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [realtimeVersion, setRealtimeVersion] = useState(0);
  const realtimeTimerRef = useRef<number | null>(null);

  const accessibleBranches = useMemo<Branch[]>(() => buildAccessibleBranches(user), [user]);
  const branchOptions = useMemo(
    () => accessibleBranches.map((branch) => ({ id: branch.id, name: branch.name })),
    [accessibleBranches],
  );
  const branchNameById = useMemo(() => {
    return new Map(accessibleBranches.map((branch) => [branch.id, branch.name]));
  }, [accessibleBranches]);
  const canChooseBranch = accessibleBranches.length > 1;

  const load = useCallback((): void => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
    });

    if (debouncedQuery) {
      params.set('search', debouncedQuery);
    }

    if (canChooseBranch && branchFilter !== 'ALL') {
      params.set('branchId', branchFilter);
    }

    if (includeOverdue) {
      params.set('includeOverdue', 'true');
    }

    api
      .get<TodayFollowUpListResponse>(`/v1/followups/today?${params.toString()}`)
      .then((response) => {
        if (response.total > 0 && page > response.totalPages) {
          setPage(response.totalPages);
          return;
        }

        setFollowUps(response.items);
        setTotal(response.total);
        setTotalPages(response.totalPages);
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load follow-ups');
        setFollowUps([]);
        setTotal(0);
        setTotalPages(1);
      })
      .finally(() => setLoading(false));
  }, [branchFilter, canChooseBranch, debouncedQuery, includeOverdue, page, profile?.tenantId, selectedBranchId]);

  useEffect(() => {
    setBranchFilter((current) => {
      return resolveBranchFilterValue(current, selectedBranchId, branchOptions);
    });
  }, [branchOptions, selectedBranchId]);

  useEffect(() => {
    setPage(1);
  }, [branchFilter, debouncedQuery, includeOverdue, profile?.tenantId, selectedBranchId]);

  useEffect(() => {
    load();
  }, [load, realtimeVersion]);

  useEffect(() => {
    return subscribeInvalidation((event) => {
      if (!user || event.tenantId !== user.tenantId) {
        return;
      }

      if (event.event !== REALTIME_INVALIDATION_EVENTS.TODAY_INVALIDATE) {
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

        <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              data-tour-id="today-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Filter by ${dictionary.labels.leadSingular.toLowerCase()} name or phone`}
              className="pl-9"
            />
          </div>
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
          <Checkbox
            checked={includeOverdue}
            onChange={(event) => setIncludeOverdue(event.target.checked)}
            label="Include overdue"
          />
        </div>
      </div>

      <Card data-tour-id="today-queue" className="rounded-3xl border-white/80 bg-card/95">
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
          ) : followUps.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center">
              <p className="font-semibold">{dictionary.labels.emptyFollowups}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                You are caught up. New reminders will appear here automatically.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {followUps.map((followUp) => (
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
                      {canChooseBranch ? (
                        <p>
                          {followUp.lead.branchId
                            ? (branchNameById.get(followUp.lead.branchId) ?? 'Unknown branch')
                            : 'Unassigned branch'}
                        </p>
                      ) : null}
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
                      {canChooseBranch ? <TableHead>Branch</TableHead> : null}
                      <TableHead>Phone</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Assignee</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {followUps.map((followUp) => (
                      <TableRow key={followUp.id}>
                        <TableCell className="font-semibold">{followUp.lead.name}</TableCell>
                        {canChooseBranch ? (
                          <TableCell>
                            {followUp.lead.branchId
                              ? (branchNameById.get(followUp.lead.branchId) ?? 'Unknown branch')
                              : 'Unassigned branch'}
                          </TableCell>
                        ) : null}
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
    </div>
  );
}
