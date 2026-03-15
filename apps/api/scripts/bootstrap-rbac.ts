import { PrismaClient } from '@prisma/client';
import { IndustryPreset } from '@leadops/shared';
import {
  getAllPermissionKeys,
  getDefaultRoleTemplates,
  PERMISSION_CATALOG,
} from '../src/access-control/permission-catalog';

const prisma = new PrismaClient();

function parseIndustryPreset(value: string): IndustryPreset {
  return (Object.values(IndustryPreset) as string[]).includes(value)
    ? (value as IndustryPreset)
    : IndustryPreset.GENERIC;
}

async function provisionPermissionCatalog(): Promise<number> {
  let upserted = 0;

  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        description: permission.description,
        group: permission.group,
      },
      create: permission,
    });
    upserted += 1;
  }

  return upserted;
}

async function provisionTenantRoles(tenantId: string, preset: IndustryPreset): Promise<number> {
  const permissionRecords = await prisma.permission.findMany({
    where: {
      key: {
        in: getAllPermissionKeys(),
      },
    },
    select: {
      id: true,
      key: true,
    },
  });

  const permissionMap = new Map(permissionRecords.map((permission) => [permission.key, permission.id]));
  let rolesProvisioned = 0;

  for (const template of getDefaultRoleTemplates(preset)) {
    const role = await prisma.permissionRole.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name: template.name,
        },
      },
      update: {
        description: template.description,
        isSystem: template.isSystem ?? false,
      },
      create: {
        tenantId,
        name: template.name,
        description: template.description,
        isSystem: template.isSystem ?? false,
      },
    });

    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id },
    });

    const permissionIds = template.permissionKeys
      .map((key) => permissionMap.get(key))
      .filter((value): value is string => !!value);

    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }

    rolesProvisioned += 1;
  }

  return rolesProvisioned;
}

async function resolveTargetTenants(filterTenantId?: string): Promise<Array<{
  id: string;
  slug: string;
  industryPreset: IndustryPreset;
}>> {
  const tenants = await prisma.tenant.findMany({
    where: filterTenantId ? { id: filterTenantId } : undefined,
    select: {
      id: true,
      slug: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (tenants.length === 0) {
    if (filterTenantId) {
      throw new Error(`Tenant not found: ${filterTenantId}`);
    }

    return [];
  }

  const configs = await prisma.tenantConfig.findMany({
    where: {
      tenantId: {
        in: tenants.map((tenant) => tenant.id),
      },
    },
    select: {
      tenantId: true,
      industryPreset: true,
    },
  });

  const configByTenantId = new Map(configs.map((config) => [config.tenantId, config]));

  return tenants.map((tenant) => {
    const config = configByTenantId.get(tenant.id);
    if (!config) {
      throw new Error(`Tenant ${tenant.slug} (${tenant.id}) is missing tenant_config`);
    }

    return {
      id: tenant.id,
      slug: tenant.slug,
      industryPreset: parseIndustryPreset(config.industryPreset),
    };
  });
}

async function main(): Promise<void> {
  const filterTenantId = process.env.TENANT_ID?.trim() || undefined;
  const permissionsUpserted = await provisionPermissionCatalog();
  const tenants = await resolveTargetTenants(filterTenantId);

  let rolesProvisioned = 0;
  for (const tenant of tenants) {
    rolesProvisioned += await provisionTenantRoles(tenant.id, tenant.industryPreset);
  }

  // eslint-disable-next-line no-console
  console.log(
    `RBAC bootstrap complete: permissions=${permissionsUpserted}, tenants=${tenants.length}, roles=${rolesProvisioned}`,
  );
  // eslint-disable-next-line no-console
  console.log(
    tenants.length === 0
      ? 'No tenants found. Permission catalog provisioned only.'
      : filterTenantId
      ? `Processed tenant: ${filterTenantId}`
      : 'Processed all tenants in the current database.',
  );
}

main()
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(
      `RBAC bootstrap failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
