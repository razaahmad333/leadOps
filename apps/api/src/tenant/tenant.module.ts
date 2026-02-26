import { Global, Module } from '@nestjs/common';
import { TenantConfigService } from './tenant-config.service';

@Global()
@Module({
  providers: [TenantConfigService],
  exports: [TenantConfigService],
})
export class TenantModule {}
