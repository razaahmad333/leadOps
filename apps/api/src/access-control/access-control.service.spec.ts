import { BranchScopeType, IndustryPreset, Role, UserStatus } from '@leadops/shared';
import { AccessControlService } from './access-control.service';
import { AuthUserCacheService } from './auth-user-cache.service';

type PrismaMock = {
  permission: {
    count: jest.Mock;
    findMany: jest.Mock;
    upsert: jest.Mock;
  };
  tenant: {
    findMany: jest.Mock;
  };
  tenantConfig: {
    findUnique: jest.Mock;
  };
  permissionRole: {
    findMany: jest.Mock;
    findUnique: jest.Mock;
  };
  branch: {
    findMany: jest.Mock;
  };
  user: {
    findFirst: jest.Mock;
    findMany: jest.Mock;
  };
  userRole: {
    deleteMany: jest.Mock;
    createMany: jest.Mock;
    findMany: jest.Mock;
  };
};

type AuthCacheMock = Pick<
  AuthUserCacheService,
  'getOrLoad' | 'buildCacheKey' | 'membershipKeys' | 'invalidateKeys'
>;

function createService(overrides?: Partial<PrismaMock>): {
  service: AccessControlService;
  prisma: PrismaMock;
  cache: jest.Mocked<AuthCacheMock>;
} {
  const prisma: PrismaMock = {
    permission: {
      count: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    tenant: {
      findMany: jest.fn(),
    },
    tenantConfig: {
      findUnique: jest.fn(),
    },
    permissionRole: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    branch: {
      findMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    userRole: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    ...(overrides ?? {}),
  };

  const cache: jest.Mocked<AuthCacheMock> = {
    getOrLoad: jest.fn(async (_cacheKey, loader) => ({
      value: await loader(),
      source: 'db' as const,
      stats: { hit: 0, miss: 1, l1: 0, l2: 0, db: 1, error: 0, singleflight: 0 },
    })),
    buildCacheKey: jest.fn((tenantId: string, userId: string, includeAvailableTenants: boolean) =>
      `leadops:auth-user:v1:${tenantId}:${userId}:${includeAvailableTenants ? 'full' : 'slim'}`),
    membershipKeys: jest.fn((tenantId: string, userId: string) => [
      `leadops:auth-user:v1:${tenantId}:${userId}:slim`,
      `leadops:auth-user:v1:${tenantId}:${userId}:full`,
    ]),
    invalidateKeys: jest.fn(),
  };

  const service = new AccessControlService(prisma as never, cache as never);
  return { service, prisma, cache };
}

describe('AccessControlService RBAC baseline', () => {
  it('fails startup validation when permission catalog is empty', async () => {
    const { service, prisma } = createService();

    prisma.permission.count.mockResolvedValue(0);
    prisma.tenant.findMany.mockResolvedValue([]);

    await expect(service.validateStartupRbacBaseline()).rejects.toThrow(
      'permission catalog is empty',
    );
  });

  it('fails startup validation when a tenant is missing required system roles', async () => {
    const { service, prisma } = createService();

    prisma.permission.count.mockResolvedValue(1);
    prisma.tenant.findMany.mockResolvedValue([
      { id: 'tenant-1', slug: 'demo' },
    ]);
    prisma.tenantConfig.findUnique.mockResolvedValue({
      industryPreset: IndustryPreset.GENERIC,
    });
    prisma.permissionRole.findMany.mockResolvedValue([]);

    await expect(service.validateStartupRbacBaseline()).rejects.toThrow(
      'Tenant RBAC baseline missing required system roles',
    );
  });

  it('passes startup validation when permission catalog and system roles exist', async () => {
    const { service, prisma } = createService();

    prisma.permission.count.mockResolvedValue(1);
    prisma.tenant.findMany.mockResolvedValue([
      { id: 'tenant-1', slug: 'demo' },
    ]);
    prisma.tenantConfig.findUnique.mockResolvedValue({
      industryPreset: IndustryPreset.GENERIC,
    });
    prisma.permissionRole.findMany.mockResolvedValue([
      { name: 'Tenant Admin' },
    ]);

    await expect(service.validateStartupRbacBaseline()).resolves.toBeUndefined();
  });

  it('rejects assigning zero roles to a non-admin user', async () => {
    const { service, prisma } = createService();

    prisma.tenantConfig.findUnique.mockResolvedValue({
      industryPreset: IndustryPreset.GENERIC,
    });

    await expect(
      service.setUserRoles('user-1', 'tenant-1', [], false),
    ).rejects.toThrow('At least one role must be assigned for non-admin users');
  });

  it('rejects tenant-admin role assignment when admin system role is missing', async () => {
    const { service, prisma } = createService();

    prisma.tenantConfig.findUnique.mockResolvedValue({
      industryPreset: IndustryPreset.GENERIC,
    });
    prisma.permissionRole.findUnique.mockResolvedValue(null);

    await expect(
      service.setUserRoles('user-1', 'tenant-1', [], true),
    ).rejects.toThrow('Tenant RBAC baseline missing required system role');
  });

  it('rejects auth hydration for non-admin users without role assignments', async () => {
    const { service, prisma } = createService();

    prisma.branch.findMany.mockResolvedValue([]);
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      accountId: 'account-1',
      email: 'user@example.com',
      name: 'User',
      role: 'STAFF',
      isSuperAdmin: false,
      isTenantAdmin: false,
      status: 'ACTIVE',
      defaultBranchId: null,
      branchScopes: [],
      userRoles: [],
    });

    await expect(service.buildAuthUser('user-1', 'tenant-1')).rejects.toThrow(
      'User has no assigned roles',
    );
  });

  it('skips membership lookup when includeAvailableTenants is false', async () => {
    const { service, prisma, cache } = createService();

    cache.getOrLoad.mockImplementation(async (_key, loader) => ({
      value: await loader(),
      source: 'db',
      stats: { hit: 0, miss: 1, l1: 0, l2: 0, db: 1, error: 0, singleflight: 0 },
    }));

    prisma.branch.findMany.mockResolvedValue([]);
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      accountId: 'account-1',
      email: 'user@example.com',
      name: 'User',
      role: 'STAFF',
      isSuperAdmin: false,
      isTenantAdmin: false,
      status: 'ACTIVE',
      defaultBranchId: null,
      branchScopes: [],
      userRoles: [
        {
          role: {
            rolePermissions: [
              {
                permission: {
                  key: 'roles.view',
                },
              },
            ],
          },
        },
      ],
    });

    const user = await service.buildAuthUser('user-1', 'tenant-1', undefined, {
      includeAvailableTenants: false,
    });

    expect(user.availableTenants).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('loads memberships when includeAvailableTenants is true', async () => {
    const { service, prisma, cache } = createService();

    cache.getOrLoad.mockImplementation(async (_key, loader) => ({
      value: await loader(),
      source: 'db',
      stats: { hit: 0, miss: 1, l1: 0, l2: 0, db: 1, error: 0, singleflight: 0 },
    }));

    prisma.branch.findMany.mockResolvedValue([]);
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      tenantId: 'tenant-1',
      accountId: 'account-1',
      email: 'user@example.com',
      name: 'User',
      role: 'STAFF',
      isSuperAdmin: false,
      isTenantAdmin: false,
      status: 'ACTIVE',
      defaultBranchId: null,
      branchScopes: [],
      userRoles: [
        {
          role: {
            rolePermissions: [
              {
                permission: {
                  key: 'roles.view',
                },
              },
            ],
          },
        },
      ],
    });
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        tenantId: 'tenant-1',
        role: 'STAFF',
        isSuperAdmin: false,
        isTenantAdmin: false,
        tenant: { name: 'Demo', slug: 'demo' },
      },
    ]);

    const user = await service.buildAuthUser('user-1', 'tenant-1', undefined, {
      includeAvailableTenants: true,
    });

    expect(user.availableTenants).toHaveLength(1);
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
  });

  it('uses shared auth cache before hitting DB', async () => {
    const { service, prisma, cache } = createService();

    cache.getOrLoad.mockResolvedValue({
      value: {
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
      },
      source: 'l1',
      stats: { hit: 1, miss: 0, l1: 1, l2: 0, db: 0, error: 0, singleflight: 0 },
    });

    const user = await service.buildAuthUser('user-1', 'tenant-1');

    expect(user.id).toBe('user-1');
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.branch.findMany).not.toHaveBeenCalled();
  });

  it('invalidates membership cache after setUserRoles mutation', async () => {
    const { service, prisma, cache } = createService();

    prisma.tenantConfig.findUnique.mockResolvedValue({
      industryPreset: IndustryPreset.GENERIC,
    });
    prisma.permissionRole.findMany.mockResolvedValue([
      { id: 'role-1' },
    ]);

    await service.setUserRoles('user-1', 'tenant-1', ['role-1'], false);

    expect(cache.invalidateKeys).toHaveBeenCalledWith([
      'leadops:auth-user:v1:tenant-1:user-1:slim',
      'leadops:auth-user:v1:tenant-1:user-1:full',
    ]);
  });

  it('invalidates all account memberships', async () => {
    const { service, prisma, cache } = createService();

    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1', tenantId: 'tenant-1' },
      { id: 'user-2', tenantId: 'tenant-2' },
    ]);

    await service.invalidateAccountMemberships('account-1');

    expect(cache.invalidateKeys).toHaveBeenCalledWith([
      'leadops:auth-user:v1:tenant-1:user-1:slim',
      'leadops:auth-user:v1:tenant-1:user-1:full',
      'leadops:auth-user:v1:tenant-2:user-2:slim',
      'leadops:auth-user:v1:tenant-2:user-2:full',
    ]);
  });

  it('invalidates users assigned to a role', async () => {
    const { service, prisma, cache } = createService();

    prisma.userRole.findMany.mockResolvedValue([
      {
        user: {
          id: 'user-1',
          tenantId: 'tenant-1',
        },
      },
    ]);

    await service.invalidateUsersAssignedToRole('role-1');

    expect(cache.invalidateKeys).toHaveBeenCalledWith([
      'leadops:auth-user:v1:tenant-1:user-1:slim',
      'leadops:auth-user:v1:tenant-1:user-1:full',
    ]);
  });

  it('invalidates all tenant users', async () => {
    const { service, prisma, cache } = createService();

    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1' },
      { id: 'user-2' },
    ]);

    await service.invalidateTenantUsers('tenant-1');

    expect(cache.invalidateKeys).toHaveBeenCalledWith([
      'leadops:auth-user:v1:tenant-1:user-1:slim',
      'leadops:auth-user:v1:tenant-1:user-1:full',
      'leadops:auth-user:v1:tenant-1:user-2:slim',
      'leadops:auth-user:v1:tenant-1:user-2:full',
    ]);
  });
});
