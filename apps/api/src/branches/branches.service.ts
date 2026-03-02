import { Injectable } from '@nestjs/common';
import { Branch } from '@leadops/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { getTenantContext } from '../tenant/tenant.store';

@Injectable()
export class BranchesService {
  constructor(private readonly accessControl: AccessControlService) {}

  async findAll(): Promise<Branch[]> {
    const tenantId = getTenantContext()?.tenantId;
    const branches = await this.accessControl.listTenantBranches(tenantId ?? '');

    return branches.map((branch) => ({
      id: branch.id,
      tenantId: branch.tenantId,
      name: branch.name,
    }));
  }
}
