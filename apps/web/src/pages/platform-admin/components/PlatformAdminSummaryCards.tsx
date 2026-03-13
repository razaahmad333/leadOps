import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import type { PlatformAdminSummary } from '@leadops/shared';

type PlatformAdminSummaryCardsProps = {
  summary: PlatformAdminSummary | null;
};

export function PlatformAdminSummaryCards({ summary }: PlatformAdminSummaryCardsProps): React.JSX.Element {
  const tenantCount = summary?.tenantCount ?? 0;
  const accountCount = summary?.accountCount ?? 0;
  const membershipCount = summary?.membershipCount ?? 0;

  return (
    <Card className="rounded-[2rem] border-white/70 bg-card/90">
      <CardHeader>
        <CardTitle>Platform Admin</CardTitle>
        <CardDescription>Tenant-first operations with scalable server-side listing.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/70 bg-secondary/30 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tenants</p>
          <p className="mt-2 text-2xl font-semibold">{tenantCount}</p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-secondary/30 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Accounts</p>
          <p className="mt-2 text-2xl font-semibold">{accountCount}</p>
        </div>
        <div className="rounded-2xl border border-white/70 bg-secondary/30 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Memberships</p>
          <p className="mt-2 text-2xl font-semibold">{membershipCount}</p>
        </div>
      </CardContent>
    </Card>
  );
}
