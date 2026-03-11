import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AccountsModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
