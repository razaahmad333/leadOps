import { Module } from '@nestjs/common';
import { AccountIdentityService } from './account-identity.service';

@Module({
  providers: [AccountIdentityService],
  exports: [AccountIdentityService],
})
export class AccountsModule {}
