import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Search } from 'lucide-react';
import {
  REALTIME_INVALIDATION_EVENTS,
  type Branch,
  type DueQueueStatus,
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
import { Input } from '../components/ui/input';
import { RefreshButton } from '../components/ui/refresh-button';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { cn } from '../lib/utils';

const PAGE_SIZE = 20;
const DUE_QUEUE_STATUS_OPTIONS: Array<{ value: DueQueueStatus; label: string }> = [
  { value: 'all', label: 'All due' },
  { value: 'due_today', label: 'Due today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'escalated', label: 'Escalated' },
];

function followupKindLabel(kind: string): string {
  if (kind === 'POST_REPORT') {
    return 'Post-Report';
  }

  return kind.replace('_', ' ');
}

function followupPurposeLabel(followUp: TodayFollowUp): string {
  if (followUp.purposeLabel) {
    return followUp.purposeLabel;
  }

  return 'General Follow-up';
}

function getEmptyStateCopy(status: DueQueueStatus, followupLabel: string): { title: string; description: string } {
  const normalizedLabel = followupLabel.toLowerCase();

  if (status === 'due_today') {
    return {
      title: `No ${normalizedLabel}s scheduled for today.`,
      description: 'Nothing is due today. Overdue or escalated work can be reviewed from the status filter.',
    };
  }

  if (status === 'overdue') {
    return {
      title: `No overdue ${normalizedLabel}s.`,
      description: 'Everything due before today has been cleared or rescheduled.',
    };
  }

  if (status === 'escalated') {
    return {
      title: `No escalated ${normalizedLabel}s.`,
      description: 'There are no escalated items in the queue right now.',
    };
  }

  return {
    title: `No overdue, escalated, or due-today ${normalizedLabel}s.`,
    description: 'You are caught up. Future-scheduled reminders will appear here when they become due.',
  };
}

function isEscalated(followUp: TodayFollowUp): boolean {
  return followUp.escalatedAt !== null || followUp.secondEscalatedAt !== null;
}

function isSecondLevelEscalated(followUp: TodayFollowUp): boolean {
  return followUp.secondEscalatedAt !== null;
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
  const [statusFilter, setStatusFilter] = useState<DueQueueStatus>('all');
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
  const emptyStateCopy = useMemo(
    () => getEmptyStateCopy(statusFilter, dictionary.labels.followupLabel),
    [dictionary.labels.followupLabel, statusFilter],
  );

  const load = useCallback((): void => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      status: statusFilter,
    });

    if (debouncedQuery) {
      params.set('search', debouncedQuery);
    }

    if (canChooseBranch && branchFilter !== 'ALL') {
      params.set('branchId', branchFilter);
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
  }, [branchFilter, canChooseBranch, debouncedQuery, page, profile?.tenantId, selectedBranchId, statusFilter]);

  useEffect(() => {
    setBranchFilter((current) => {
      return resolveBranchFilterValue(current, selectedBranchId, branchOptions);
    });
  }, [branchOptions, selectedBranchId]);

  useEffect(() => {
    setPage(1);
  }, [branchFilter, debouncedQuery, profile?.tenantId, selectedBranchId, statusFilter]);

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
          <h1 className="text-2xl font-bold">Due Queue</h1>
          <p className="text-sm text-muted-foreground">
            Review due-today, overdue, and escalated {dictionary.labels.followupLabel.toLowerCase()}s in one queue.
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
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as DueQueueStatus)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm lg:w-40"
          >
            {DUE_QUEUE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <RefreshButton loading={loading} onClick={load} className="w-full lg:w-auto" />
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
              <p className="font-semibold">{emptyStateCopy.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{emptyStateCopy.description}</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {followUps.map((followUp) => (
                  <div
                    key={followUp.id}
                    className={cn(
                      'rounded-2xl border border-white/70 bg-background/70 p-4',
                      isSecondLevelEscalated(followUp)
                        ? 'border-red-300 bg-red-100/80 shadow-md'
                        : isEscalated(followUp)
                          ? 'border-red-200 bg-red-50/70 shadow-sm'
                          : null,
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{followUp.lead.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{followUp.lead.phone ?? 'No phone'}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge variant={followUp.kind === 'POST_REPORT' ? 'warning' : 'secondary'}>
                          {followupKindLabel(followUp.kind)}
                        </Badge>
                        {isEscalated(followUp) ? <Badge variant="danger">Escalated</Badge> : null}
                        {isSecondLevelEscalated(followUp) ? <Badge variant="outline">L2</Badge> : null}
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">{followupPurposeLabel(followUp)}</p>
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
                      <TableRow
                        key={followUp.id}
                        className={cn(
                          isSecondLevelEscalated(followUp)
                            ? 'bg-red-100/70 hover:bg-red-100'
                            : isEscalated(followUp)
                              ? 'bg-red-50/50 hover:bg-red-100/60'
                              : null,
                        )}
                      >
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
                          <div className="flex flex-wrap gap-2">
                            <Badge variant={followUp.kind === 'POST_REPORT' ? 'warning' : 'secondary'}>
                              {followupKindLabel(followUp.kind)}
                            </Badge>
                            {isEscalated(followUp) ? <Badge variant="danger">Escalated</Badge> : null}
                            {isSecondLevelEscalated(followUp) ? <Badge variant="outline">L2</Badge> : null}
                          </div>
                          <p className="mt-2 text-sm text-foreground">{followupPurposeLabel(followUp)}</p>
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
