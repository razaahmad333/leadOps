import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';

function validateWorkerEnv(env: Record<string, unknown>): Record<string, unknown> {
  const databaseUrl = String(env.DATABASE_URL ?? '').trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const redisHost = String(env.REDIS_HOST ?? 'localhost').trim() || 'localhost';
  const redisPortRaw = String(env.REDIS_PORT ?? '6379').trim();
  const redisPort = Number.parseInt(redisPortRaw, 10);
  if (!Number.isInteger(redisPort) || redisPort <= 0) {
    throw new Error('REDIS_PORT must be a positive integer');
  }

  const nodeEnvRaw = String(env.NODE_ENV ?? 'development');
  const nodeEnv = nodeEnvRaw === 'production' || nodeEnvRaw === 'test' ? nodeEnvRaw : 'development';

  return {
    ...env,
    DATABASE_URL: databaseUrl,
    REDIS_HOST: redisHost,
    REDIS_PORT: redisPort,
    NODE_ENV: nodeEnv,
  };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: validateWorkerEnv,
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      },
    }),
    PrismaModule,
    QueueModule,
  ],
})
export class WorkerModule {}
