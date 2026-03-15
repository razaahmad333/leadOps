import { Global, Module } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { AuthUserCacheService } from './auth-user-cache.service';
import { BranchScopeService } from './branch-scope.service';
import { PermissionsGuard } from './permissions.guard';

@Global()
@Module({
  providers: [AccessControlService, AuthUserCacheService, BranchScopeService, PermissionsGuard],
  exports: [AccessControlService, BranchScopeService, PermissionsGuard],
})
export class AccessControlModule {}
