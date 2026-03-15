import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { SettingsController } from './settings.controller';

@Module({
  imports: [QueueModule],
  controllers: [SettingsController],
})
export class SettingsModule {}
