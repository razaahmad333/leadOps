import React, { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar.tsx';
import { api } from '../lib/api.ts';
import { useToast } from '../context/ToastContext.tsx';
import { type DashboardStats } from '@leadops/shared';

interface StatCard {
  key: keyof DashboardStats;
  label: string;
  color: string;
}

const STAT_CARDS: StatCard[] = [
  { key: 'new', label: 'New Leads', color: 'bg-blue-500' },
  { key: 'contacted', label: 'Contacted', color: 'bg-yellow-500' },
  { key: 'pending', label: 'Pending', color: 'bg-orange-500' },
  { key: 'won', label: 'Won', color: 'bg-green-500' },
  { key: 'lost', label: 'Lost', color: 'bg-red-500' },
  { key: 'todayFollowups', label: "Today's Follow-ups", color: 'bg-purple-500' },
];

export function DashboardPage(): React.JSX.Element {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    api
      .get<DashboardStats>('/v1/dashboard/stats')
      .then(setStats)
      .catch((err: Error) => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-200" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {STAT_CARDS.map(({ key, label, color }) => (
              <div key={key} className={`rounded-xl p-6 text-white shadow-sm ${color}`}>
                <p className="text-sm font-medium opacity-90">{label}</p>
                <p className="mt-2 text-4xl font-bold">{stats[key]}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No stats available.</p>
        )}
      </main>
    </div>
  );
}
