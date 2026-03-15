import { AuthUser, BranchScopeType, Role, UserStatus } from '@leadops/shared';
import { AuthUserCacheService } from './auth-user-cache.service';

function buildUser(): AuthUser {
  return {
    id: 'user-1',
    accountId: 'account-1',
    email: 'user@example.com',
    name: 'User',
    role: Role.STAFF,
    tenantId: 'tenant-1',
    defaultBranchId: null,
    isSuperAdmin: false,
    isTenantAdmin: false,
    status: UserStatus.ACTIVE,
    effectivePermissions: ['roles.view'],
    availableTenants: [],
    branchScope: {
      scopeType: BranchScopeType.ALL_BRANCHES,
      branchIds: [],
      branchNames: [],
    },
  };
}

describe('AuthUserCacheService', () => {
  function mockRedisClient(
    service: AuthUserCacheService,
    redis: {
      get: jest.Mock;
      set: jest.Mock;
      del: jest.Mock;
      publish: jest.Mock;
    },
  ): void {
    const mutable = service as unknown as {
      ensureRedisClient: () => Promise<unknown>;
    };

    jest.spyOn(mutable, 'ensureRedisClient').mockResolvedValue(redis as never);
  }

  it('serves from L1 cache on repeated reads', async () => {
    const service = new AuthUserCacheService();
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(0),
      publish: jest.fn().mockResolvedValue(0),
    };
    mockRedisClient(service, redis);

    const loader = jest.fn().mockResolvedValue(buildUser());
    await service.getOrLoad('k1', loader);
    const second = await service.getOrLoad('k1', loader);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(second.source).toBe('l1');
  });

  it('serves from L2 cache without DB loader call', async () => {
    const service = new AuthUserCacheService();
    const cached = buildUser();
    const redis = {
      get: jest.fn().mockResolvedValue(JSON.stringify(cached)),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(0),
      publish: jest.fn().mockResolvedValue(0),
    };
    mockRedisClient(service, redis);

    const loader = jest.fn();
    const result = await service.getOrLoad('k1', loader);

    expect(result.source).toBe('l2');
    expect(loader).not.toHaveBeenCalled();
  });

  it('fails open to DB hydration when Redis read errors', async () => {
    const service = new AuthUserCacheService();
    const redis = {
      get: jest.fn().mockRejectedValue(new Error('redis down')),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(0),
      publish: jest.fn().mockResolvedValue(0),
    };
    mockRedisClient(service, redis);

    const loader = jest.fn().mockResolvedValue(buildUser());
    const result = await service.getOrLoad('k1', loader);

    expect(result.source).toBe('db');
    expect(result.stats.error).toBe(1);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent misses with singleflight', async () => {
    const service = new AuthUserCacheService();
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(0),
      publish: jest.fn().mockResolvedValue(0),
    };
    mockRedisClient(service, redis);

    const loader = jest.fn(
      () =>
        new Promise<AuthUser>((resolve) => {
          setTimeout(() => resolve(buildUser()), 20);
        }),
    );

    const [first, second] = await Promise.all([
      service.getOrLoad('k1', loader),
      service.getOrLoad('k1', loader),
    ]);

    expect(loader).toHaveBeenCalledTimes(1);
    expect([first.source, second.source].sort()).toEqual(['db', 'singleflight']);
  });
});
