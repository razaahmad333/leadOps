import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type FaqQuestion,
  type FaqQuestionListResponse,
} from '@leadops/shared';
import { MessageSquare, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import { api } from '../lib/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { RefreshButton } from '../components/ui/refresh-button';
import { Skeleton } from '../components/ui/skeleton';
import { Textarea } from '../components/ui/textarea';

const PAGE_SIZE = 20;

type FaqStatusFilter = 'all' | 'open' | 'answered';

function statusVariant(status: FaqQuestion['status']): 'warning' | 'success' {
  return status === 'OPEN' ? 'warning' : 'success';
}

function statusLabel(status: FaqQuestion['status']): string {
  return status === 'OPEN' ? 'Open' : 'Answered';
}

function formatDate(value: Date | string | null): string {
  if (!value) {
    return 'Not answered yet';
  }

  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString();
}

function questionScopeLabel(item: FaqQuestion): string {
  const branchLabel = item.branch?.name ?? 'All branches';
  return `${item.tenant.name} · ${branchLabel}`;
}

export function FaqPage(): React.JSX.Element {
  const { user, can } = useAuth();
  const canAnswer = Boolean(user?.isSuperAdmin || can('faq.answer'));

  const [items, setItems] = useState<FaqQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<FaqStatusFilter>('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const [questionDraft, setQuestionDraft] = useState('');
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [answeringId, setAnsweringId] = useState<string | null>(null);

  const loadQuestions = useCallback(async (): Promise<void> => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        status: statusFilter,
      });

      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }

      const response = await api.get<FaqQuestionListResponse>(`/v1/faq?${params.toString()}`);
      setItems(response.items);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load questions');
      setItems([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const openCount = useMemo(() => items.filter((item) => item.status === 'OPEN').length, [items]);

  const submitQuestion = async (): Promise<void> => {
    const question = questionDraft.trim();
    if (!question) {
      toast.error('Please enter a question');
      return;
    }

    setSubmittingQuestion(true);
    try {
      await api.post<FaqQuestion>('/v1/faq', { question });
      setQuestionDraft('');
      setPage(1);
      toast.success('Question submitted');
      await loadQuestions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit question');
    } finally {
      setSubmittingQuestion(false);
    }
  };

  const submitAnswer = async (questionId: string): Promise<void> => {
    const answer = (answerDrafts[questionId] ?? '').trim();
    if (!answer) {
      toast.error('Please enter an answer');
      return;
    }

    setAnsweringId(questionId);
    try {
      await api.patch<FaqQuestion>(`/v1/faq/${questionId}/answer`, { answer });
      setAnswerDrafts((current) => {
        const next = { ...current };
        delete next[questionId];
        return next;
      });
      toast.success('Answer saved');
      await loadQuestions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save answer');
    } finally {
      setAnsweringId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2 pt-2 sm:pt-3">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Support</p>
          <h1 className="text-2xl font-bold">Q&amp;A Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Submit tenant questions and answer them inside the app. Answered items become shared reference for the team.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <RefreshButton loading={loading} onClick={() => void loadQuestions()} className="rounded-full px-3 py-1" />
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {total.toLocaleString()} visible
          </Badge>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {openCount.toLocaleString()} open on this page
          </Badge>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
        <Card className="rounded-3xl border-white/80 bg-card/95">
          <CardHeader>
            <CardTitle>Ask a question</CardTitle>
            <CardDescription>
              Use this for process, workflow, or tenant-specific questions that should stay visible for the team.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={questionDraft}
              onChange={(event) => setQuestionDraft(event.target.value)}
              placeholder="Ask a process or workflow question"
              className="min-h-36"
            />
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>Questions are visible to tenant answerers and become shared once answered.</span>
              <span>{questionDraft.trim().length}/2000</span>
            </div>
            <Button onClick={() => void submitQuestion()} disabled={submittingQuestion}>
              {submittingQuestion ? 'Submitting...' : 'Submit question'}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-white/80 bg-card/95">
          <CardHeader className="space-y-4">
            <div>
              <CardTitle>Inbox</CardTitle>
              <CardDescription>
                {canAnswer
                  ? 'Review open questions, search history, and answer from the same workspace.'
                  : 'Track your open questions and browse answered guidance from your tenant.'}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search questions or answers"
                  className="pl-9"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as FaqStatusFilter)}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm lg:w-40"
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="answered">Answered</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="space-y-3 rounded-2xl border border-white/70 bg-background/60 p-4">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/80 bg-background/60 px-6 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="font-medium">No questions found</p>
                  <p className="text-sm text-muted-foreground">
                    Adjust the filters or submit a new question to start the inbox.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => {
                  const draft = answerDrafts[item.id] ?? '';

                  return (
                    <div key={item.id} className="space-y-4 rounded-2xl border border-white/70 bg-background/60 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                            <span className="text-xs text-muted-foreground">
                              Asked by {item.askedBy.name} in {questionScopeLabel(item)} on {formatDate(item.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm font-medium leading-6 text-foreground">{item.question}</p>
                        </div>
                      </div>

                      {item.answer ? (
                        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Answer</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{item.answer}</p>
                          <p className="mt-3 text-xs text-muted-foreground">
                            Answered by {item.answeredBy?.name ?? 'Unknown'} on {formatDate(item.answeredAt)}
                          </p>
                        </div>
                      ) : canAnswer ? (
                        <div className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">Answer question</p>
                          <Textarea
                            value={draft}
                            onChange={(event) =>
                              setAnswerDrafts((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                            placeholder="Write an answer that the team can reuse"
                            className="min-h-28 bg-background"
                          />
                          <div className="flex justify-end">
                            <Button
                              onClick={() => void submitAnswer(item.id)}
                              disabled={answeringId === item.id}
                            >
                              {answeringId === item.id ? 'Saving...' : 'Answer'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/80 bg-background/50 p-4 text-sm text-muted-foreground">
                          Waiting for a tenant answerer or superadmin to respond.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between border-t border-white/70 pt-4 text-sm text-muted-foreground">
              <span>
                Showing {items.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-{(page - 1) * PAGE_SIZE + items.length} of{' '}
                {total}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  Previous
                </Button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
