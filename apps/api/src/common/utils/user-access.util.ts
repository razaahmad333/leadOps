import { BadRequestException } from '@nestjs/common';
import { BranchScopeInput, BranchScopeSummary, BranchScopeType } from '@leadops/shared';

type BranchOption = {
  id: string;
  name: string;
};

type ScopedBranch = {
  branchId: string;
  branch: {
    name: string;
  };
};

export function resolveRoleIds(roleId: string | null | undefined, roleIds: string[] | undefined): string[] {
  if (roleIds && roleIds.length > 0) {
    return roleIds;
  }

  if (roleId) {
    return [roleId];
  }

  return [];
}

export function normalizeBranchScopeInput(options: {
  input: BranchScopeInput | undefined;
  existingBranchIds?: string[];
  forceAllBranches: boolean;
}): BranchScopeInput {
  if (options.forceAllBranches) {
    return {
      scopeType: BranchScopeType.ALL_BRANCHES,
      branchIds: [],
    };
  }

  if (!options.input) {
    if (options.existingBranchIds && options.existingBranchIds.length > 0) {
      return {
        scopeType: BranchScopeType.SELECTED,
        branchIds: [...new Set(options.existingBranchIds)],
      };
    }

    return {
      scopeType: BranchScopeType.ALL_BRANCHES,
      branchIds: [],
    };
  }

  if (options.input.scopeType === BranchScopeType.ALL_BRANCHES) {
    return {
      scopeType: BranchScopeType.ALL_BRANCHES,
      branchIds: [],
    };
  }

  const uniqueBranchIds = [...new Set(options.input.branchIds)];
  if (uniqueBranchIds.length === 0) {
    throw new BadRequestException('Select at least one branch for a scoped user');
  }

  return {
    scopeType: BranchScopeType.SELECTED,
    branchIds: uniqueBranchIds,
  };
}

export function resolveDefaultBranchId(
  candidate: string | null | undefined,
  branchScope: BranchScopeInput,
  forceAllBranches: boolean,
): string | null {
  if (forceAllBranches) {
    return null;
  }

  if (branchScope.scopeType === BranchScopeType.ALL_BRANCHES) {
    return candidate ?? null;
  }

  if (candidate && branchScope.branchIds.includes(candidate)) {
    return candidate;
  }

  return branchScope.branchIds[0] ?? null;
}

export function buildBranchScopeSummary(options: {
  forceAllBranches: boolean;
  assignedBranches: ScopedBranch[];
  allBranches: BranchOption[];
}): BranchScopeSummary {
  if (options.forceAllBranches || options.assignedBranches.length === 0) {
    return {
      scopeType: BranchScopeType.ALL_BRANCHES,
      branchIds: options.allBranches.map((branch) => branch.id),
      branchNames: options.allBranches.map((branch) => branch.name),
    };
  }

  return {
    scopeType: BranchScopeType.SELECTED,
    branchIds: options.assignedBranches.map((scope) => scope.branchId),
    branchNames: options.assignedBranches.map((scope) => scope.branch.name),
  };
}
