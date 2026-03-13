import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  requestId: string;
  selectedBranchId?: string;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(strict = true): TenantContext | undefined {
  const store = tenantStorage.getStore();

  if (!store && strict) {
    throw new Error('Tenant context not initialized for request');
  }

  return store;
}
