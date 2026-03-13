import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  CreateUserDto,
  CreateUserSchema,
  ResetPasswordDto,
  ResetPasswordSchema,
  TeamUser,
  UpdateUserDto,
  UpdateUserSchema,
} from '@leadops/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Permissions } from '../access-control/permissions.decorator';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('users.manage')
  @ApiOperation({ summary: 'List users for the current tenant' })
  findAll(): Promise<TeamUser[]> {
    return this.usersService.findAll();
  }

  @Post()
  @Permissions('users.manage')
  @ApiOperation({ summary: 'Create a user in the current tenant' })
  create(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(CreateUserSchema)) dto: CreateUserDto,
  ): Promise<TeamUser> {
    return this.usersService.create(dto, actor.id);
  }

  @Patch(':id')
  @Permissions('users.manage')
  @ApiOperation({ summary: 'Update a tenant user' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) dto: UpdateUserDto,
    @CurrentUser() actor: { id: string },
  ): Promise<TeamUser> {
    return this.usersService.update(id, dto, actor.id);
  }

  @Post(':id/reset-password')
  @Permissions('users.manage')
  @ApiOperation({ summary: 'Reset a tenant user password' })
  async resetPassword(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(ResetPasswordSchema)) dto: ResetPasswordDto,
  ): Promise<{ success: boolean }> {
    await this.usersService.resetPassword(id, dto.password, actor.id);
    return { success: true };
  }
}
