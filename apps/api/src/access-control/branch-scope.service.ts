import { ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser, BranchScopeType } from '@leadops/shared';

@Injectable()
export class BranchScopeService {
  branchIdsFor(user: AuthUser): string[] | null {
    if (user.isSuperAdmin || user.isTenantAdmin || user.branchScope.scopeType === BranchScopeType.ALL_BRANCHES) {
      return null;
    }

    return user.branchScope.branchIds;
  }

  applyLeadFilter<T extends Record<string, unknown>>(user: AuthUser, where: T): T {
    const branchIds = this.branchIdsFor(user);
    if (!branchIds) {
      return where;
    }

    return {
      ...where,
      branchId: {
        in: branchIds,
      },
    };
  }

  applyLeadFilterForSelectedBranch<T extends Record<string, unknown>>(
    user: AuthUser,
    where: T,
    selectedBranchId?: string | null,
  ): T {
    if (selectedBranchId) {
      this.ensureBranchAccess(user, selectedBranchId);

      return {
        ...where,
        branchId: selectedBranchId,
      };
    }

    return this.applyLeadFilter(user, where);
  }

  ensureBranchAccess(user: AuthUser, branchId: string | null | undefined): void {
    const branchIds = this.branchIdsFor(user);
    if (!branchIds || !branchId) {
      return;
    }

    if (!branchIds.includes(branchId)) {
      throw new ForbiddenException('This user does not have access to the selected branch');
    }
  }

  ensureLeadAccess(user: AuthUser, lead: { branchId: string | null | undefined }): void {
    this.ensureBranchAccess(user, lead.branchId);
  }
}
