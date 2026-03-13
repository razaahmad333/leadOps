import type { BranchScopeType } from '@leadops/shared';

export const TENANT_PAGE_SIZE = 20;
export const DRAWER_USERS_PAGE_SIZE = 20;
export const DRAWER_AUDIT_PAGE_SIZE = 20;

export const BRANCH_SCOPE: Record<'ALL' | 'SELECTED', BranchScopeType> = {
  ALL: 'ALL_BRANCHES' as BranchScopeType,
  SELECTED: 'SELECTED' as BranchScopeType,
};
