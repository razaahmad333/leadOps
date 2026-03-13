import React from 'react';
import type { PlatformTenantDetails } from '@leadops/shared';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';

type UsersTabProps = {
  users: PlatformTenantDetails['users'];
  usersPageMeta: PlatformTenantDetails['usersPage'];
  tenantDetailsLoading: boolean;
  onOpenEdit: (user: PlatformTenantDetails['users'][number]) => void;
  onOpenPassword: (user: PlatformTenantDetails['users'][number]) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function UsersTab(props: UsersTabProps): React.JSX.Element {
  const {
    users,
    usersPageMeta,
    tenantDetailsLoading,
    onOpenEdit,
    onOpenPassword,
    onPrevPage,
    onNextPage,
  } = props;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                No users for this tenant.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.phone || 'No phone'}</p>
                  <p className="text-xs text-muted-foreground">
                    Roles: {user.roleNames.join(', ') || 'No roles'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user.branchScope.scopeType === 'ALL_BRANCHES'
                      ? `All branches (${user.branchScope.branchIds.length})`
                      : `${user.branchScope.branchNames.join(', ') || 'No branches'}`}
                  </p>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={user.status === 'ACTIVE' ? 'secondary' : 'outline'}>
                      {user.status}
                    </Badge>
                    {user.isTenantAdmin ? <Badge variant="outline">Tenant Admin</Badge> : null}
                    {user.isSuperAdmin ? <Badge variant="outline">Super Admin</Badge> : null}
                  </div>
                </TableCell>
                <TableCell>{new Date(user.updatedAt).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => onOpenEdit(user)}>
                      Edit Info
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => onOpenPassword(user)}>
                      Reset Password
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {usersPageMeta ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {usersPageMeta.page} of {usersPageMeta.totalPages} ({usersPageMeta.total} users)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={usersPageMeta.page <= 1 || tenantDetailsLoading}
              onClick={onPrevPage}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={usersPageMeta.page >= usersPageMeta.totalPages || tenantDetailsLoading}
              onClick={onNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
