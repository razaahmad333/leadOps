import { Global, Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantConfigService } from './tenant-config.service';

@Global()
@Module({
  controllers: [TenantController],
  providers: [TenantConfigService],
  exports: [TenantConfigService],
})
export class TenantModule {}
