import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimePublisherService } from './realtime.publisher.service';
import { RealtimeRedisBridgeService } from './realtime.redis-bridge.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [
    RealtimeGateway,
    RealtimePublisherService,
    RealtimeRedisBridgeService,
  ],
  exports: [RealtimePublisherService],
})
export class RealtimeModule {}
