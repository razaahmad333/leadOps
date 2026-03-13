import type { AuthUser, Branch } from '@leadops/shared';

export interface BranchOption {
  id: string;
  name: string;
}

export function buildBranchOptions(user: AuthUser | null | undefined): BranchOption[] {
  if (!user) {
    return [];
  }

  return user.branchScope.branchIds.map((branchId, index) => ({
    id: branchId,
    name: user.branchScope.branchNames[index] ?? `Branch ${index + 1}`,
  }));
}

export function buildAccessibleBranches(user: AuthUser | null | undefined): Branch[] {
  if (!user) {
    return [];
  }

  return buildBranchOptions(user).map((branch) => ({
    id: branch.id,
    tenantId: user.tenantId,
    name: branch.name,
    description: null,
    isActive: true,
  }));
}

export function resolveBranchFilterValue(
  current: string,
  selectedBranchId: string | null,
  options: BranchOption[],
): string {
  const optionIds = new Set(options.map((option) => option.id));

  if (selectedBranchId && optionIds.has(selectedBranchId)) {
    return selectedBranchId;
  }

  if (current === 'ALL' || optionIds.has(current)) {
    return current;
  }

  return 'ALL';
}

export function resolveBranchScopeLabel(
  options: BranchOption[],
  selectedBranchId: string | null,
): string {
  const selectedName = options.find((branch) => branch.id === selectedBranchId)?.name ?? null;
  if (selectedName) {
    return selectedName;
  }

  if (options.length > 1) {
    return `All branches (${options.length})`;
  }

  if (options.length === 1) {
    return options[0]?.name ?? 'No branches assigned';
  }

  return 'No branches assigned';
}

export function resolveCreateBranchDefault(
  current: string,
  selectedBranchId: string | null,
  defaultBranchId: string | null | undefined,
  options: BranchOption[],
): string {
  const optionIds = new Set(options.map((option) => option.id));

  if (current && optionIds.has(current)) {
    return current;
  }

  if (selectedBranchId && optionIds.has(selectedBranchId)) {
    return selectedBranchId;
  }

  if (defaultBranchId && optionIds.has(defaultBranchId)) {
    return defaultBranchId;
  }

  if (options.length === 1) {
    return options[0]?.id ?? '';
  }

  return '';
}

