import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { AuthUser } from '@leadops/shared';
import Redis from 'ioredis';

export interface AuthUserCacheLookup {
  value: AuthUser;
  source: 'l1' | 'l2' | 'db' | 'singleflight';
  stats: {
    hit: number;
    miss: number;
    l1: number;
    l2: number;
    db: number;
    error: number;
    singleflight: number;
  };
}

interface CachedAuthUser {
  expiresAt: number;
  value: AuthUser;
}

const CACHE_KEY_PREFIX = 'leadops:auth-user:v1';
const INVALIDATION_CHANNEL = 'leadops:auth-user:invalidate';

@Injectable()
export class AuthUserCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AuthUserCacheService.name);
  private readonly ttlMs = 10_000;
  private readonly maxL1Entries = 2_000;
  private readonly l1 = new Map<string, CachedAuthUser>();
  private readonly inflight = new Map<string, Promise<AuthUser>>();

  private redisClient: Redis | null = null;
  private redisSubscriber: Redis | null = null;
  private nextRedisInitAttemptAt = 0;
  private readonly redisInitCooldownMs = 30_000;

  buildCacheKey(tenantId: string, userId: string, includeAvailableTenants: boolean): string {
    return `${CACHE_KEY_PREFIX}:${tenantId}:${userId}:${includeAvailableTenants ? 'full' : 'slim'}`;
  }

  membershipKeys(tenantId: string, userId: string): string[] {
    return [
      this.buildCacheKey(tenantId, userId, false),
      this.buildCacheKey(tenantId, userId, true),
    ];
  }

  async getOrLoad(cacheKey: string, loader: () => Promise<AuthUser>): Promise<AuthUserCacheLookup> {
    const l1Value = this.readL1(cacheKey);
    if (l1Value) {
      return {
        value: l1Value,
        source: 'l1',
        stats: {
          hit: 1,
          miss: 0,
          l1: 1,
          l2: 0,
          db: 0,
          error: 0,
          singleflight: 0,
        },
      };
    }

    const l2Lookup = await this.readL2(cacheKey);
    const errors = l2Lookup.error ? 1 : 0;
    const l2Value = l2Lookup.value;
    if (l2Value) {
      this.writeL1(cacheKey, l2Value);
      return {
        value: l2Value,
        source: 'l2',
        stats: {
          hit: 1,
          miss: 0,
          l1: 0,
          l2: 1,
          db: 0,
          error: errors,
          singleflight: 0,
        },
      };
    }

    const existing = this.inflight.get(cacheKey);
    if (existing) {
      const value = await existing;
      return {
        value,
        source: 'singleflight',
        stats: {
          hit: 0,
          miss: 1,
          l1: 0,
          l2: 0,
          db: 0,
          error: errors,
          singleflight: 1,
        },
      };
    }

    const promise = this.loadAndPopulate(cacheKey, loader).finally(() => {
      this.inflight.delete(cacheKey);
    });
    this.inflight.set(cacheKey, promise);

    const value = await promise;
    return {
      value,
      source: 'db',
      stats: {
        hit: 0,
        miss: 1,
        l1: 0,
        l2: 0,
        db: 1,
        error: errors,
        singleflight: 0,
      },
    };
  }

  async invalidateKeys(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    for (const key of keys) {
      this.l1.delete(key);
      this.inflight.delete(key);
    }

    const redis = await this.ensureRedisClient();
    if (!redis) {
      return;
    }

    try {
      await redis.del(...keys);
      await redis.publish(INVALIDATION_CHANNEL, JSON.stringify({ keys }));
    } catch (error: unknown) {
      this.logger.warn(
        `Auth cache invalidation publish failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnectRedis();
  }

  private async loadAndPopulate(cacheKey: string, loader: () => Promise<AuthUser>): Promise<AuthUser> {
    const value = await loader();
    this.writeL1(cacheKey, value);
    await this.writeL2(cacheKey, value);
    return value;
  }

  private readL1(cacheKey: string): AuthUser | null {
    const cached = this.l1.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (cached.expiresAt <= Date.now()) {
      this.l1.delete(cacheKey);
      return null;
    }

    return cached.value;
  }

  private writeL1(cacheKey: string, value: AuthUser): void {
    this.l1.set(cacheKey, {
      expiresAt: Date.now() + this.ttlMs,
      value,
    });

    if (this.l1.size > this.maxL1Entries) {
      const oldest = this.l1.keys().next().value;
      if (oldest) {
        this.l1.delete(oldest);
      }
    }
  }

  private async readL2(cacheKey: string): Promise<{ value: AuthUser | null; error: boolean }> {
    const redis = await this.ensureRedisClient();
    if (!redis) {
      return { value: null, error: false };
    }

    try {
      const raw = await redis.get(cacheKey);
      if (!raw) {
        return { value: null, error: false };
      }

      return { value: JSON.parse(raw) as AuthUser, error: false };
    } catch (error: unknown) {
      this.logger.warn(
        `Auth cache read failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return { value: null, error: true };
    }
  }

  private async writeL2(cacheKey: string, value: AuthUser): Promise<void> {
    const redis = await this.ensureRedisClient();
    if (!redis) {
      return;
    }

    try {
      await redis.set(cacheKey, JSON.stringify(value), 'PX', this.ttlMs);
    } catch (error: unknown) {
      this.logger.warn(
        `Auth cache write failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
  }

  private async ensureRedisClient(): Promise<Redis | null> {
    const now = Date.now();
    if (now < this.nextRedisInitAttemptAt) {
      return this.redisClient;
    }

    if (this.redisClient) {
      return this.redisClient;
    }

    const host = process.env.REDIS_HOST ?? 'localhost';
    const port = parseInt(process.env.REDIS_PORT ?? '6379', 10);

    const client = new Redis({
      host,
      port,
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    const subscriber = client.duplicate({
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });

    client.on('error', (error) => {
      this.logger.warn(`Auth cache Redis client error: ${error.message}`);
    });
    subscriber.on('error', (error) => {
      this.logger.warn(`Auth cache Redis subscriber error: ${error.message}`);
    });

    try {
      await client.connect();
      await subscriber.connect();
      await subscriber.subscribe(INVALIDATION_CHANNEL);
      subscriber.on('message', (channel, payload) => {
        if (channel !== INVALIDATION_CHANNEL) {
          return;
        }

        this.handleInvalidationMessage(payload);
      });

      this.redisClient = client;
      this.redisSubscriber = subscriber;
      this.nextRedisInitAttemptAt = 0;
      return this.redisClient;
    } catch (error: unknown) {
      this.nextRedisInitAttemptAt = Date.now() + this.redisInitCooldownMs;
      this.logger.warn(
        `Auth cache Redis unavailable (fail-open): ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );

      try {
        await subscriber.quit();
      } catch {
        await subscriber.disconnect(false);
      }

      try {
        await client.quit();
      } catch {
        await client.disconnect(false);
      }

      return null;
    }
  }

  private handleInvalidationMessage(payload: string): void {
    try {
      const parsed = JSON.parse(payload) as { keys?: string[] };
      if (!Array.isArray(parsed.keys)) {
        return;
      }

      for (const key of parsed.keys) {
        this.l1.delete(key);
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Auth cache invalidation payload ignored: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private async disconnectRedis(): Promise<void> {
    if (this.redisSubscriber) {
      try {
        await this.redisSubscriber.unsubscribe(INVALIDATION_CHANNEL);
        await this.redisSubscriber.quit();
      } catch {
        this.redisSubscriber.disconnect(false);
      } finally {
        this.redisSubscriber = null;
      }
    }

    if (this.redisClient) {
      try {
        await this.redisClient.quit();
      } catch {
        this.redisClient.disconnect(false);
      } finally {
        this.redisClient = null;
      }
    }
  }
}
