import React, { useEffect, useState, useCallback } from 'react';
import { Navbar } from '../components/Navbar.tsx';
import { api } from '../lib/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { type FollowUp } from '@leadops/shared';

// Extend with the included lead data from the API
interface FollowUpWithLead extends FollowUp {
  lead?: { name: string; phone: string | null };
}

export function TodayPage(): React.JSX.Element {
  const [followUps, setFollowUps] = useState<FollowUpWithLead[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const load = useCallback((): void => {
    setLoading(true);
    api
      .get<FollowUpWithLead[]>('/v1/followups/today')
      .then(setFollowUps)
      .catch((err: Error) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const markDone = async (id: string): Promise<void> => {
    try {
      await api.patch(`/v1/followups/${id}/done`, {});
      showToast('Marked as done!', 'success');
      load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Today's Follow-ups</h1>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : followUps.length === 0 ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
            <p className="font-medium text-green-700">All caught up! No follow-ups due today.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {followUps.map((fu) => (
              <div
                key={fu.id}
                className="flex items-start justify-between gap-4 rounded-xl bg-white p-5 shadow-sm"
              >
                <div>
                  {fu.lead && (
                    <p className="font-semibold text-gray-900">{fu.lead.name}</p>
                  )}
                  {fu.lead?.phone && (
                    <p className="text-sm text-gray-500">{fu.lead.phone}</p>
                  )}
                  {fu.note && <p className="mt-1 text-sm text-gray-600">{fu.note}</p>}
                  <p className="mt-1 text-xs text-gray-400">
                    {new Date(fu.scheduledAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => void markDone(fu.id)}
                  className="shrink-0 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
                >
                  Done
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
