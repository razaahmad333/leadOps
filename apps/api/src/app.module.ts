import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { TenantModule } from './tenant/tenant.module';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { AuthModule } from './auth/auth.module';
import { LeadsModule } from './leads/leads.module';
import { FollowUpsModule } from './follow-ups/follow-ups.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    // Config — must be first, isGlobal exposes env vars to all modules
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // BullMQ — Redis connection
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),

    // Infrastructure modules (global)
    PrismaModule,
    TenantModule,

    // Feature modules
    AuthModule,
    LeadsModule,
    FollowUpsModule,
    DashboardModule,
    HealthModule,
    QueueModule,
  ],
})
export class AppModule implements NestModule {
  /**
   * Apply TenantMiddleware to ALL routes.
   * This runs before guards, so every handler has access to tenant context.
   * Routes that skip auth (like /auth/login) still get a tenant context,
   * which is needed to look up users by email within the correct tenant.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
