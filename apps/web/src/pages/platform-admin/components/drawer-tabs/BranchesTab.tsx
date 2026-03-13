import React from 'react';
import type { PlatformTenantDetails } from '@leadops/shared';
import { Badge } from '../../../../components/ui/badge';
import { Button } from '../../../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';

type BranchesTabProps = {
  branches: PlatformTenantDetails['branches'];
  togglingBranchId: string | null;
  onCreateBranch: () => void;
  onEditBranch: (branch: PlatformTenantDetails['branches'][number]) => void;
  onToggleStatus: (branch: PlatformTenantDetails['branches'][number]) => void;
};

export function BranchesTab(props: BranchesTabProps): React.JSX.Element {
  const { branches, togglingBranchId, onCreateBranch, onEditBranch, onToggleStatus } = props;

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" onClick={onCreateBranch}>
          Create Branch
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Branch</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {branches.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                No branches for this tenant.
              </TableCell>
            </TableRow>
          ) : (
            branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="font-medium">{branch.name}</TableCell>
                <TableCell>{branch.description || 'No description'}</TableCell>
                <TableCell>
                  <Badge variant={branch.isActive ? 'secondary' : 'outline'}>
                    {branch.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell>{new Date(branch.updatedAt).toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" onClick={() => onEditBranch(branch)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={togglingBranchId === branch.id}
                      onClick={() => onToggleStatus(branch)}
                    >
                      {branch.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </>
  );
}
