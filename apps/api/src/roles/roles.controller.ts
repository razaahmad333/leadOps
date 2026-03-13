import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateRoleDto,
  CreateRoleSchema,
  RoleDetail,
  RoleSummary,
  UpdateRoleDto,
  UpdateRoleSchema,
} from '@leadops/shared';
import { Permissions } from '../access-control/permissions.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { RolesService } from './roles.service';

@ApiTags('roles')
@ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions('roles.view')
  @ApiOperation({ summary: 'List roles for the current tenant' })
  findAll(): Promise<RoleSummary[]> {
    return this.rolesService.findAll();
  }

  @Post()
  @Permissions('roles.manage')
  @ApiOperation({ summary: 'Create a tenant-scoped role' })
  create(@Body(new ZodValidationPipe(CreateRoleSchema)) dto: CreateRoleDto): Promise<RoleDetail> {
    return this.rolesService.create(dto);
  }

  @Get(':id')
  @Permissions('roles.view')
  @ApiOperation({ summary: 'Get role details' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<RoleDetail> {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @Permissions('roles.manage')
  @ApiOperation({ summary: 'Update a tenant-scoped role' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateRoleSchema)) dto: UpdateRoleDto,
  ): Promise<RoleDetail> {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @Permissions('roles.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tenant-scoped role' })
  async remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    await this.rolesService.remove(id);
  }
}
