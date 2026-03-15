import { UnauthorizedException } from '@nestjs/common';
import { BranchScopeType, Role, UserStatus } from '@leadops/shared';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  function createStrategy() {
    const config = {
      getOrThrow: jest.fn().mockReturnValue('a'.repeat(64)),
    };
    const accessControl = {
      buildAuthUser: jest.fn(),
    };

    const strategy = new JwtStrategy(config as never, accessControl as never);
    return { strategy, accessControl };
  }

  it('builds auth user via access control without availableTenants payload', async () => {
    const { strategy, accessControl } = createStrategy();

    accessControl.buildAuthUser.mockResolvedValue({
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
    });

    const result = await strategy.validate({
      sub: 'user-1',
      accountId: 'account-1',
      role: Role.STAFF,
      tenantId: 'tenant-1',
      kind: 'access',
    });

    expect(accessControl.buildAuthUser).toHaveBeenCalledWith(
      'user-1',
      'tenant-1',
      undefined,
      { includeAvailableTenants: false },
    );
    expect(result.id).toBe('user-1');
  });

  it('rejects inactive users after hydration', async () => {
    const { strategy, accessControl } = createStrategy();

    accessControl.buildAuthUser.mockResolvedValue({
      id: 'user-1',
      accountId: 'account-1',
      email: 'user@example.com',
      name: 'User',
      role: Role.STAFF,
      tenantId: 'tenant-1',
      defaultBranchId: null,
      isSuperAdmin: false,
      isTenantAdmin: false,
      status: UserStatus.INACTIVE,
      effectivePermissions: ['roles.view'],
      availableTenants: [],
      branchScope: {
        scopeType: BranchScopeType.ALL_BRANCHES,
        branchIds: [],
        branchNames: [],
      },
    });

    await expect(
      strategy.validate({
        sub: 'user-1',
        accountId: 'account-1',
        role: Role.STAFF,
        tenantId: 'tenant-1',
        kind: 'access',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
