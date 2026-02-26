import React, { useEffect, useMemo, useState, type FormEvent } from 'react';
import { MessageSquarePlus, Plus, Search } from 'lucide-react';
import type { Lead, LeadDetail } from '@leadops/shared';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Textarea } from '../components/ui/textarea';

type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'PENDING' | 'WON' | 'LOST';
interface CreateLeadFormState {
  name: string;
  nextFollowUpAt: string;
  email: string;
  phone: string;
  note: string;
}

const STATUS_OPTIONS: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PENDING', 'WON', 'LOST'];

function statusVariant(status: LeadStatus): 'default' | 'success' | 'warning' | 'danger' | 'secondary' {
  if (status === 'WON') return 'success';
  if (status === 'LOST') return 'danger';
  if (status === 'PENDING') return 'warning';
  if (status === 'NEW') return 'default';
  return 'secondary';
}

function toDateTimeLocal(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return '';
  const date = new Date(dateValue);
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

function createDefaultLeadForm(): CreateLeadFormState {
  return {
    name: '',
    nextFollowUpAt: toDateTimeLocal(new Date(Date.now() + 2 * 60 * 60 * 1000)),
    email: '',
    phone: '',
    note: '',
  };
}

export function LeadsPage(): React.JSX.Element {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | LeadStatus>('ALL');

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLeadDetail, setSelectedLeadDetail] = useState<LeadDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateLeadFormState>(createDefaultLeadForm);

  const [statusDraft, setStatusDraft] = useState<LeadStatus | null>(null);
  const [followupDraft, setFollowupDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');

  const loadLeads = (): void => {
    setLoading(true);
    api
      .get<Lead[]>('/v1/leads')
      .then(setLeads)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load leads');
      })
      .finally(() => setLoading(false));
  };

  const loadLeadDetail = (id: string): void => {
    setDetailLoading(true);
    api
      .get<LeadDetail>(`/v1/leads/${id}`)
      .then((detail) => {
        setSelectedLeadDetail(detail);
        setStatusDraft(detail.lead.status as unknown as LeadStatus);
        setFollowupDraft(toDateTimeLocal(detail.lead.nextFollowUpAt));
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load lead detail');
      })
      .finally(() => setDetailLoading(false));
  };

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    if (!selectedLeadId) {
      setSelectedLeadDetail(null);
      return;
    }
    loadLeadDetail(selectedLeadId);
  }, [selectedLeadId]);

  const filtered = useMemo(() => {
    return leads.filter((lead) => {
      const matchesQuery = lead.name.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' ? true : lead.status === (statusFilter as unknown as Lead['status']);
      return matchesQuery && matchesStatus;
    });
  }, [leads, query, statusFilter]);

  const createLead = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!createForm.name.trim() || !createForm.nextFollowUpAt) {
      toast.error('Lead name and next follow-up are required');
      return;
    }

    const nextFollowUpAtIso = toIsoFromDateTimeLocal(createForm.nextFollowUpAt);
    if (!nextFollowUpAtIso) {
      toast.error('Invalid next follow-up datetime');
      return;
    }

    setCreating(true);

    try {
      await api.post('/v1/leads', {
        name: createForm.name.trim(),
        email: createForm.email.trim() || undefined,
        phone: createForm.phone.trim() || undefined,
        note: createForm.note.trim() || undefined,
        nextFollowUpAt: nextFollowUpAtIso,
      });
      toast.success('Lead created');
      setFormOpen(false);
      setCreateForm(createDefaultLeadForm());
      loadLeads();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create lead');
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (): Promise<void> => {
    if (!selectedLeadDetail || !statusDraft) return;

    try {
      const nextFollowUpAtIso = followupDraft ? toIsoFromDateTimeLocal(followupDraft) : null;
      await api.patch(`/v1/leads/${selectedLeadDetail.lead.id}/status`, {
        status: statusDraft,
        nextFollowUpAt: nextFollowUpAtIso ?? undefined,
      });
      toast.success('Lead status updated');
      loadLeads();
      loadLeadDetail(selectedLeadDetail.lead.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    }
  };

  const addNote = async (): Promise<void> => {
    if (!selectedLeadDetail || !noteDraft.trim()) return;

    try {
      await api.post(`/v1/leads/${selectedLeadDetail.lead.id}/notes`, { note: noteDraft.trim() });
      toast.success('Note added');
      setNoteDraft('');
      loadLeadDetail(selectedLeadDetail.lead.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add note');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">Track lead status, next follow-up, and activity timeline.</p>
        </div>

        <Button onClick={() => setFormOpen((open) => !open)}>
          <Plus className="h-4 w-4" />
          {formOpen ? 'Close form' : 'New lead'}
        </Button>
      </div>

      {formOpen ? (
        <Card>
          <CardHeader>
            <CardTitle>Create lead</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(event) => void createLead(event)} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lead-name">Lead name</Label>
                <Input
                  id="lead-name"
                  value={createForm.name}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-followup">Next follow-up</Label>
                <Input
                  id="lead-followup"
                  type="datetime-local"
                  value={createForm.nextFollowUpAt}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, nextFollowUpAt: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-email">Email</Label>
                <Input
                  id="lead-email"
                  type="email"
                  value={createForm.email}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-phone">Phone</Label>
                <Input
                  id="lead-phone"
                  value={createForm.phone}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="lead-note">Initial note</Label>
                <Textarea
                  id="lead-note"
                  value={createForm.note}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, note: event.target.value }))}
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create lead'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search lead"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'ALL' | LeadStatus)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="ALL">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
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
              <p className="font-semibold">No leads found</p>
              <p className="mt-1 text-sm text-muted-foreground">Adjust filters or create a new lead.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next follow-up</TableHead>
                  <TableHead>Contact</TableHead>
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
                      <Badge variant={statusVariant(lead.status as unknown as LeadStatus)}>{lead.status}</Badge>
                    </TableCell>
                    <TableCell>{lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleString() : 'N/A'}</TableCell>
                    <TableCell>
                      <div>{lead.email ?? 'No email'}</div>
                      <div className="text-xs text-muted-foreground">{lead.phone ?? 'No phone'}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedLeadId} onOpenChange={(open) => !open && setSelectedLeadId(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedLeadDetail?.lead.name ?? 'Lead detail'}</SheetTitle>
            <SheetDescription>Status, follow-up commitments, notes, and activity timeline.</SheetDescription>
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
                  <CardTitle className="text-base">Lead status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <select
                    value={statusDraft ?? (selectedLeadDetail.lead.status as unknown as LeadStatus)}
                    onChange={(event) => setStatusDraft(event.target.value as LeadStatus)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
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
                    Save status
                  </Button>
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
