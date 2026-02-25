import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Unit test skeleton for AuthService.
 * Proves Jest wiring is correct.
 * Full tests would mock PrismaService and JwtService.
 */
describe('AuthService', () => {
  let service: AuthService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('mock-access-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw UnauthorizedException when user is not found', async () => {
    mockPrismaService.user.findUnique.mockResolvedValue(null);

    // We need a tenant context for this test — in unit tests, we mock the tenant store
    const { tenantStorage } = await import('../../tenant/tenant.store');
    const result = new Promise<void>((resolve, reject) => {
      tenantStorage.run({ tenantId: 'test-tenant-id', tenantSlug: 'test' }, async () => {
        try {
          await service.login({ email: 'notfound@test.com', password: 'Password123!' });
          reject(new Error('Expected UnauthorizedException'));
        } catch (err) {
          const error = err as Error;
          expect(error.constructor.name).toBe('UnauthorizedException');
          resolve();
        }
      });
    });

    await result;
  });
});
