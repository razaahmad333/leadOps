import React from 'react';
import type { PlatformTenantSummary } from '@leadops/shared';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import type { SortOrder, TenantSortBy } from '../platform-admin.types';

type TenantDirectoryCardProps = {
  queryInput: string;
  onQueryInputChange: (value: string) => void;
  sortBy: TenantSortBy;
  onSortByChange: (value: string) => void;
  sortOrder: SortOrder;
  onSortOrderChange: (value: string) => void;
  onCreateTenant: () => void;
  onCreateAccess: () => void;

  tenants: PlatformTenantSummary[];
  tableEmpty: boolean;
  onOpenTenant: (tenantId: string) => void;

  page: number;
  totalPages: number;
  total: number;
  tenantsLoading: boolean;
  tableFooterLabel: string;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function TenantDirectoryCard(props: TenantDirectoryCardProps): React.JSX.Element {
  const {
    queryInput,
    onQueryInputChange,
    sortBy,
    onSortByChange,
    sortOrder,
    onSortOrderChange,
    onCreateTenant,
    onCreateAccess,
    tenants,
    tableEmpty,
    onOpenTenant,
    page,
    totalPages,
    tenantsLoading,
    tableFooterLabel,
    onPrevPage,
    onNextPage,
  } = props;

  return (
    <Card data-tour-id="platform-tenant-directory" className="rounded-[2rem] border-white/70 bg-card/90">
      <CardHeader>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <CardTitle>Tenant Directory</CardTitle>
            <CardDescription>
              Search, sort, and paginate tenants. Click a row to open tenant details.
            </CardDescription>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
            <Button onClick={onCreateTenant}>Create Tenant</Button>
            <Button variant="outline" onClick={onCreateAccess}>Create Account Access</Button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <Input
            value={queryInput}
            onChange={(event) => onQueryInputChange(event.target.value)}
            placeholder="Search by tenant name or slug"
          />
          <Select value={sortBy} onChange={(event) => onSortByChange(event.target.value)}>
            <option value="createdAt">Sort: Created At</option>
            <option value="name">Sort: Tenant Name</option>
            <option value="userCount">Sort: User Count</option>
          </Select>
          <Select value={sortOrder} onChange={(event) => onSortOrderChange(event.target.value)}>
            <option value="desc">Order: Descending</option>
            <option value="asc">Order: Ascending</option>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="overflow-x-auto rounded-2xl border border-white/70">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableEmpty ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No tenants found for current filters.
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((tenant) => (
                  <TableRow
                    key={tenant.id}
                    className="cursor-pointer"
                    onClick={() => onOpenTenant(tenant.id)}
                  >
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell className="text-muted-foreground">{tenant.slug}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {tenant.industryPreset === 'DIAGNOSTICS_LAB' ? 'Diagnostics Lab' : 'Generic'}
                      </Badge>
                    </TableCell>
                    <TableCell>{tenant.userCount}</TableCell>
                    <TableCell>{new Date(tenant.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenTenant(tenant.id);
                        }}
                      >
                        Open
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{tableFooterLabel}</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || tenantsLoading}
              onClick={onPrevPage}
            >
              Previous
            </Button>
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || tenantsLoading}
              onClick={onNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
