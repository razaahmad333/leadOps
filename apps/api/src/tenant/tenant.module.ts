import { Global, Module } from '@nestjs/common';
import { PublicTenantController } from './public-tenant.controller';
import { TenantController } from './tenant.controller';
import { TenantConfigService } from './tenant-config.service';

@Global()
@Module({
  controllers: [TenantController, PublicTenantController],
  providers: [TenantConfigService],
  exports: [TenantConfigService],
})
export class TenantModule {}
