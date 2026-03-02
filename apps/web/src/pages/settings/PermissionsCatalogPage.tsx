import React, { useEffect, useState } from 'react';
import type { PermissionGroup } from '@leadops/shared';
import { ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { api } from '../../lib/api';

export function PermissionsCatalogPage(): React.JSX.Element {
  const [groups, setGroups] = useState<PermissionGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<PermissionGroup[]>('/v1/permissions')
      .then(setGroups)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : 'Failed to load permissions');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Reference</p>
          <h1 className="mt-2 text-2xl font-bold">Permissions</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The live permission catalog used by roles, tenant admin access, and API guards.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit gap-1.5 rounded-full px-3 py-1">
          <ShieldCheck className="h-3.5 w-3.5" />
          Read-only
        </Badge>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No permissions are configured yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.group} className="rounded-3xl border-white/80 bg-card/95">
              <CardHeader>
                <CardTitle>{group.group}</CardTitle>
                <CardDescription>{group.permissions.length} permissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {group.permissions.map((permission) => (
                  <div key={permission.key} className="rounded-xl border bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <code className="text-xs font-semibold text-primary">{permission.key}</code>
                      <Badge variant="outline">{group.group}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{permission.description}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
