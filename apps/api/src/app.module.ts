import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { z } from 'zod';
import { AccessControlModule } from './access-control/access-control.module';
import { PermissionsGuard } from './access-control/permissions.guard';
import { AuthModule } from './auth/auth.module';
import { BranchesModule } from './branches/branches.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';
import { MetricsModule } from './common/metrics/metrics.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EventsModule } from './events/events.module';
import { FollowUpsModule } from './follow-ups/follow-ups.module';
import { FaqModule } from './faq/faq.module';
import { HealthModule } from './health/health.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { LeadsModule } from './leads/leads.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PermissionsModule } from './permissions/permissions.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RolesModule } from './roles/roles.module';
import { SettingsModule } from './settings/settings.module';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { TenantModule } from './tenant/tenant.module';
import { UsersModule } from './users/users.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (env) => {
        const schema = z.object({
          NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
          PORT: z.coerce.number().int().positive().default(3000),
          DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
          REDIS_HOST: z.string().min(1).default('localhost'),
          REDIS_PORT: z.coerce.number().int().positive().default(6379),
          JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
          JWT_EXPIRES_IN: z.string().min(1).default('7d'),
          DEPLOYMENT_MODE: z.enum(['single', 'multi']).default('single'),
          SINGLE_TENANT_ID: z.string().optional(),
          CORS_ORIGIN: z.string().optional(),
          ENABLE_SWAGGER: z.enum(['true', 'false']).optional(),
          MESSAGEBIRD_ACCESS_KEY: z.string().optional(),
          MESSAGEBIRD_VERIFY_ORIGINATOR: z.string().optional(),
          MESSAGEBIRD_VERIFY_TEMPLATE: z.string().optional(),
          MESSAGEBIRD_VERIFY_TIMEOUT_SECONDS: z.string().optional(),
        });

        const parsed = schema.parse(env);
        return {
          ...env,
          ...parsed,
        };
      },
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    PrismaModule,
    AccessControlModule,
    MetricsModule,
    TenantModule,
    AuthModule,
    LeadsModule,
    NotificationsModule,
    FollowUpsModule,
    FaqModule,
    DashboardModule,
    SettingsModule,
    PermissionsModule,
    PlatformAdminModule,
    RolesModule,
    UsersModule,
    BranchesModule,
    HealthModule,
    QueueModule,
    EventsModule,
    IntegrationsModule,
    RealtimeModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
