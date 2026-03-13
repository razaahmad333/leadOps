import React from 'react';
import type { PlatformTenantDetails } from '@leadops/shared';
import { Card, CardContent } from '../../../../components/ui/card';

type TenantTabProps = {
  tenant: PlatformTenantDetails['tenant'];
};

export function TenantTab({ tenant }: TenantTabProps): React.JSX.Element {
  return (
    <Card className="rounded-2xl border-white/70 bg-card/95">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Slug</p>
          <p className="mt-1 font-medium">{tenant.slug}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Industry</p>
          <p className="mt-1 font-medium">
            {tenant.industryPreset === 'DIAGNOSTICS_LAB' ? 'Diagnostics Lab' : 'Generic'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Users</p>
          <p className="mt-1 font-medium">{tenant.userCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Branches</p>
          <p className="mt-1 font-medium">{tenant.branchCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Created</p>
          <p className="mt-1 font-medium">{new Date(tenant.createdAt).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Updated</p>
          <p className="mt-1 font-medium">{new Date(tenant.updatedAt).toLocaleString()}</p>
        </div>
      </CardContent>
    </Card>
  );
}
