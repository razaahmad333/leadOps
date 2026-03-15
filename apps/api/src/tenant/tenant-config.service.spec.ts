import { IndustryPreset } from '@leadops/shared';
import { TenantConfigService } from './tenant-config.service';
import { getPresetDisplayConfig } from './tenant-presets';

type PrismaMock = {
  tenant: {
    findUnique: jest.Mock;
  };
  tenantConfig: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

function createService(): {
  service: TenantConfigService;
  prisma: PrismaMock;
} {
  const prisma: PrismaMock = {
    tenant: {
      findUnique: jest.fn(),
    },
    tenantConfig: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  return {
    service: new TenantConfigService(prisma as never),
    prisma,
  };
}

describe('TenantConfigService getTenantProfile', () => {
  it('fails when tenant config is missing', async () => {
    const { service, prisma } = createService();

    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      name: 'Demo Tenant',
      slug: 'demo',
      config: null,
    });

    await expect(service.getTenantProfile('tenant-1')).rejects.toThrow(
      'Tenant configuration missing',
    );
  });

  it('returns profile without writing tenant config on read path', async () => {
    const { service, prisma } = createService();
    const displayConfig = getPresetDisplayConfig(IndustryPreset.GENERIC);

    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-1',
      name: 'Demo Tenant',
      slug: 'demo',
      config: {
        industryPreset: IndustryPreset.GENERIC,
        configVersion: 1,
        displayConfig,
        timezone: 'Asia/Kolkata',
        businessStart: '09:00',
        businessEnd: '18:00',
      },
    });

    const profile = await service.getTenantProfile('tenant-1');

    expect(profile.tenantId).toBe('tenant-1');
    expect(profile.industryPreset).toBe(IndustryPreset.GENERIC);
    expect(profile.displayConfig.vocabulary.leadPlural).toBe(displayConfig.vocabulary.leadPlural);
    expect(prisma.tenantConfig.update).not.toHaveBeenCalled();
  });
});
