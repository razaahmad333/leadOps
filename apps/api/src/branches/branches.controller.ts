import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Branch } from '@leadops/shared';
import { Permissions } from '../access-control/permissions.decorator';
import { BranchesService } from './branches.service';

@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @Permissions('branches.view')
  @ApiOperation({ summary: 'List branches for the current tenant' })
  findAll(): Promise<Branch[]> {
    return this.branchesService.findAll();
  }
}
