import React from 'react';
import type { PlatformTenantDetails } from '@leadops/shared';
import { Button } from '../../../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../../components/ui/table';

type AuditTabProps = {
  auditEvents: PlatformTenantDetails['auditEvents'];
  auditPageMeta: PlatformTenantDetails['auditEventsPage'];
  tenantDetailsLoading: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function AuditTab(props: AuditTabProps): React.JSX.Element {
  const { auditEvents, auditPageMeta, tenantDetailsLoading, onPrevPage, onNextPage } = props;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {auditEvents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                No audit events yet.
              </TableCell>
            </TableRow>
          ) : (
            auditEvents.map((event) => (
              <TableRow key={event.id}>
                <TableCell>{new Date(event.createdAt).toLocaleString()}</TableCell>
                <TableCell>{event.actorName || 'System'}</TableCell>
                <TableCell>{event.action}</TableCell>
                <TableCell>
                  {event.entityType}
                  {event.entityId ? ` (${event.entityId.slice(0, 8)})` : ''}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {auditPageMeta ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {auditPageMeta.page} of {auditPageMeta.totalPages} ({auditPageMeta.total} events)
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={auditPageMeta.page <= 1 || tenantDetailsLoading}
              onClick={onPrevPage}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={auditPageMeta.page >= auditPageMeta.totalPages || tenantDetailsLoading}
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
