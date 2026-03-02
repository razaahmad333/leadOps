import { Global, Module } from '@nestjs/common';
import { AccessControlService } from './access-control.service';
import { BranchScopeService } from './branch-scope.service';
import { PermissionsGuard } from './permissions.guard';

@Global()
@Module({
  providers: [AccessControlService, BranchScopeService, PermissionsGuard],
  exports: [AccessControlService, BranchScopeService, PermissionsGuard],
})
export class AccessControlModule {}
