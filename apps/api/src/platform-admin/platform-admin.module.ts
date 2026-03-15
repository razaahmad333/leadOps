import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { QueueModule } from '../queue/queue.module';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminReadService } from './platform-admin-read.service';
import { PlatformAdminRoleOpsService } from './platform-admin-role-ops.service';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminSharedService } from './platform-admin.shared.service';
import { PlatformAdminTenantOpsService } from './platform-admin-tenant-ops.service';
import { PlatformAdminUserOpsService } from './platform-admin-user-ops.service';

@Module({
  imports: [AccountsModule, QueueModule],
  controllers: [PlatformAdminController],
  providers: [
    PlatformAdminService,
    PlatformAdminSharedService,
    PlatformAdminReadService,
    PlatformAdminTenantOpsService,
    PlatformAdminRoleOpsService,
    PlatformAdminUserOpsService,
  ],
})
export class PlatformAdminModule {}
