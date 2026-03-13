import React from 'react';
import type { PlatformTenantRole } from '@leadops/shared';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Skeleton } from '../../../../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';

type RolesTabProps = {
  tenantRolesLoading: boolean;
  tenantRoles: PlatformTenantRole[];
  onCreateRole: () => void;
  onEditRole: (role: PlatformTenantRole) => void;
};

export function RolesTab({ tenantRolesLoading, tenantRoles, onCreateRole, onEditRole }: RolesTabProps): React.JSX.Element {
  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" onClick={onCreateRole}>
          Create Role
        </Button>
      </div>

      {tenantRolesLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Assigned Users</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenantRoles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No roles for this tenant.
                </TableCell>
              </TableRow>
            ) : (
              tenantRoles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell>
                    <p className="font-medium">{role.name}</p>
                    <p className="text-xs text-muted-foreground">{role.description || 'No description'}</p>
                    {role.isSystem ? <Badge variant="outline" className="mt-2">System</Badge> : null}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{role.permissionKeys.length} permissions</p>
                    <p className="text-xs text-muted-foreground">
                      {role.permissionKeys.slice(0, 4).join(', ')}
                      {role.permissionKeys.length > 4 ? ` +${role.permissionKeys.length - 4} more` : ''}
                    </p>
                  </TableCell>
                  <TableCell>{role.userCount}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={role.isSystem}
                      onClick={() => onEditRole(role)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}
    </>
  );
}
