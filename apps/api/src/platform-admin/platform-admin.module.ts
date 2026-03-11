import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';

@Module({
  imports: [AccountsModule],
  controllers: [PlatformAdminController],
  providers: [PlatformAdminService],
})
export class PlatformAdminModule {}
