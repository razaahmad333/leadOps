import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  Branch,
  CreateBranchDto,
  CreateBranchSchema,
  UpdateBranchDto,
  UpdateBranchSchema,
} from '@leadops/shared';
import { Permissions } from '../access-control/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
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

  @Post()
  @Permissions('branches.manage')
  @ApiOperation({ summary: 'Create a branch for the current tenant' })
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateBranchSchema)) dto: CreateBranchDto,
  ): Promise<Branch> {
    return this.branchesService.create(dto, user.id);
  }

  @Patch(':id')
  @Permissions('branches.manage')
  @ApiOperation({ summary: 'Update a branch for the current tenant' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateBranchSchema)) dto: UpdateBranchDto,
  ): Promise<Branch> {
    return this.branchesService.update(id, dto, user.id);
  }
}
