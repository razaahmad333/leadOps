import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PermissionGroup } from '@leadops/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { Permissions } from '../access-control/permissions.decorator';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly accessControl: AccessControlService) {}

  @Get()
  @Permissions('permissions.view')
  @ApiOperation({ summary: 'Get the permission catalog for the current tenant' })
  getCatalog(): Promise<PermissionGroup[]> {
    return this.accessControl.listPermissionGroups();
  }
}
