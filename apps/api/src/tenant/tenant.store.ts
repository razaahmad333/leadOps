import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
}

/**
 * Singleton AsyncLocalStorage for per-request tenant context.
 *
 * Using AsyncLocalStorage instead of NestJS REQUEST-scoped providers
 * avoids scope cascade: all services remain SINGLETON-scoped while
 * still getting per-request tenant isolation.
 *
 * Usage in services:
 *   const { tenantId } = getTenantContext();
 */
export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext {
  const store = tenantStorage.getStore();
  if (!store) {
    throw new Error(
      'TenantContext not initialized. Ensure TenantMiddleware is applied before this route.',
    );
  }
  return store;
}
