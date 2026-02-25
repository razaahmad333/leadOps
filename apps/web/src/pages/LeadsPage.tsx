import React, { useEffect, useState, useCallback, type FormEvent } from 'react';
import { Navbar } from '../components/Navbar.tsx';
import { api } from '../lib/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { LeadStatus, type Lead, type CreateLeadDto } from '@leadops/shared';

const STATUS_COLORS: Record<LeadStatus, string> = {
  [LeadStatus.NEW]: 'bg-blue-100 text-blue-800',
  [LeadStatus.CONTACTED]: 'bg-yellow-100 text-yellow-800',
  [LeadStatus.QUALIFIED]: 'bg-teal-100 text-teal-700',
  [LeadStatus.PENDING]: 'bg-orange-100 text-orange-800',
  [LeadStatus.WON]: 'bg-green-100 text-green-800',
  [LeadStatus.LOST]: 'bg-red-100 text-red-800',
};

const STATUSES = Object.values(LeadStatus);

export function LeadsPage(): React.JSX.Element {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<CreateLeadDto>>({ name: '' });
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const loadLeads = useCallback((): void => {
    setLoading(true);
    api
      .get<Lead[]>('/v1/leads')
      .then(setLeads)
      .catch((err: Error) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const handleCreate = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/v1/leads', form);
      showToast('Lead created!', 'success');
      setForm({ name: '' });
      setShowForm(false);
      loadLeads();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: LeadStatus): Promise<void> => {
    try {
      await api.patch(`/v1/leads/${id}/status`, { status });
      showToast('Status updated', 'success');
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {showForm ? 'Cancel' : '+ New Lead'}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="mb-6 rounded-xl bg-white p-6 shadow-sm"
          >
            <h2 className="mb-4 font-semibold text-gray-900">New Lead</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { id: 'name', label: 'Name *', type: 'text', key: 'name' as const, required: true },
                { id: 'phone', label: 'Phone', type: 'tel', key: 'phone' as const, required: false },
                { id: 'email', label: 'Email', type: 'email', key: 'email' as const, required: false },
                { id: 'source', label: 'Source', type: 'text', key: 'source' as const, required: false },
              ].map(({ id, label, type, key, required }) => (
                <div key={id}>
                  <label htmlFor={id} className="block text-sm font-medium text-gray-700">
                    {label}
                  </label>
                  <input
                    id={id}
                    type={type}
                    required={required}
                    value={(form[key] as string) ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value || undefined }))}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create Lead'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <p className="text-gray-500">No leads yet. Create your first one!</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Contact', 'Source', 'Status', 'Created'].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {lead.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div>{lead.email}</div>
                      <div>{lead.phone}</div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {lead.source ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <select
                        value={lead.status}
                        onChange={(e) =>
                          void handleStatusChange(lead.id, e.target.value as LeadStatus)
                        }
                        className={`cursor-pointer rounded-full border-0 px-3 py-1 text-xs font-semibold ${STATUS_COLORS[lead.status]}`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
