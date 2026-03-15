import { LeadStatus, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { IndustryPreset, Role as LegacyRole } from '@leadops/shared';
import {
  getAdminRoleName,
  getDefaultBranchNames,
  getDefaultRoleTemplates,
  getLegacyRoleTemplateName,
  PERMISSION_CATALOG,
} from '../src/access-control/permission-catalog';
import { DEFAULT_TENANT_TIMEZONE } from '../src/tenant/tenant-defaults';
import { getPresetDisplayConfig } from '../src/tenant/tenant-presets';

const prisma = new PrismaClient();

async function seedPermissionCatalog(): Promise<void> {
  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        description: permission.description,
        group: permission.group,
      },
      create: permission,
    });
  }
}

async function upsertTenantWithConfig(input: {
  slug: string;
  name: string;
  industryPreset: IndustryPreset;
}) {
  const tenant = await prisma.tenant.upsert({
    where: { slug: input.slug },
    update: { name: input.name },
    create: {
      slug: input.slug,
      name: input.name,
    },
  });

  const displayConfig = getPresetDisplayConfig(input.industryPreset);

  await prisma.tenantConfig.upsert({
    where: { tenantId: tenant.id },
    update: {
      industryPreset: input.industryPreset,
      configVersion: 1,
      displayConfig,
      stages: displayConfig.pipelineConfig.stages.map((stage) => stage.label),
      reminderRules: {
        defaultLeadFollowupMinutes: displayConfig.followupRules.defaultLeadFollowupMinutes,
        firstReminderMinutes: displayConfig.followupRules.firstReminderMinutes,
        escalationMinutes: displayConfig.followupRules.escalationMinutes,
        postReportFollowupDays: displayConfig.followupRules.postReportFollowupDays,
      },
      templates: [],
      featureFlags: displayConfig.featureFlags,
    },
    create: {
      tenantId: tenant.id,
      industryPreset: input.industryPreset,
      configVersion: 1,
      displayConfig,
      timezone: DEFAULT_TENANT_TIMEZONE,
      businessStart: '09:00',
      businessEnd: '18:00',
      stages: displayConfig.pipelineConfig.stages.map((stage) => stage.label),
      reminderRules: {
        defaultLeadFollowupMinutes: displayConfig.followupRules.defaultLeadFollowupMinutes,
        firstReminderMinutes: displayConfig.followupRules.firstReminderMinutes,
        escalationMinutes: displayConfig.followupRules.escalationMinutes,
        postReportFollowupDays: displayConfig.followupRules.postReportFollowupDays,
      },
      templates: [],
      featureFlags: displayConfig.featureFlags,
    },
  });

  return tenant;
}

async function ensureTenantRoles(tenantId: string, preset: IndustryPreset) {
  const permissions = await prisma.permission.findMany({
    where: {
      key: {
        in: PERMISSION_CATALOG.map((permission) => permission.key),
      },
    },
  });

  const permissionMap = new Map(permissions.map((permission) => [permission.key, permission.id]));
  const roleMap = new Map<string, string>();

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

    roleMap.set(template.name, role.id);
  }

  return roleMap;
}

async function ensureTenantBranches(tenantId: string, preset: IndustryPreset) {
  const branches = [];

  for (const name of getDefaultBranchNames(preset)) {
    const branch = await prisma.branch.upsert({
      where: {
        tenantId_name: {
          tenantId,
          name,
        },
      },
      update: {},
      create: {
        tenantId,
        name,
      },
    });

    branches.push(branch);
  }

  return branches;
}

async function upsertAccount(input: {
  email: string;
  phone?: string | null;
  passwordHash: string;
}) {
  const normalizedPhone = input.phone ?? null;

  const [emailAccount, phoneAccount] = await Promise.all([
    prisma.account.findUnique({
      where: { email: input.email },
    }),
    normalizedPhone
      ? prisma.account.findUnique({
          where: { phone: normalizedPhone },
        })
      : Promise.resolve(null),
  ]);

  if (emailAccount && phoneAccount && emailAccount.id !== phoneAccount.id) {
    throw new Error(`Seed account collision for ${input.email}: email and phone resolve to different accounts`);
  }

  const existing = emailAccount ?? phoneAccount;
  if (existing) {
    return prisma.account.update({
      where: { id: existing.id },
      data: {
        email: input.email,
        phone: normalizedPhone,
        passwordHash: input.passwordHash,
        status: 'ACTIVE',
      },
    });
  }

  return prisma.account.create({
    data: {
      email: input.email,
      phone: normalizedPhone,
      passwordHash: input.passwordHash,
      status: 'ACTIVE',
    },
  });
}

async function upsertUser(input: {
  tenantId: string;
  accountId: string;
  email: string;
  name: string;
  legacyRole: LegacyRole;
  phone?: string | null;
  isSuperAdmin?: boolean;
  isTenantAdmin?: boolean;
  defaultBranchId?: string | null;
}) {
  return prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: input.tenantId,
        email: input.email,
      },
    },
    update: {
      accountId: input.accountId,
      name: input.name,
      phone: input.phone ?? null,
      role: input.legacyRole,
      isSuperAdmin: input.isSuperAdmin ?? false,
      isTenantAdmin: input.isTenantAdmin ?? false,
      status: 'ACTIVE',
      defaultBranchId: input.defaultBranchId ?? null,
    },
    create: {
      tenantId: input.tenantId,
      accountId: input.accountId,
      email: input.email,
      name: input.name,
      phone: input.phone ?? null,
      role: input.legacyRole,
      isSuperAdmin: input.isSuperAdmin ?? false,
      isTenantAdmin: input.isTenantAdmin ?? false,
      status: 'ACTIVE',
      defaultBranchId: input.defaultBranchId ?? null,
    },
  });
}

async function assignUserRoles(userId: string, roleIds: string[]): Promise<void> {
  await prisma.userRole.deleteMany({ where: { userId } });

  if (roleIds.length > 0) {
    await prisma.userRole.createMany({
      data: roleIds.map((roleId) => ({ userId, roleId })),
      skipDuplicates: true,
    });
  }
}

async function assignBranchScope(userId: string, branchIds: string[]): Promise<void> {
  await prisma.userBranchScope.deleteMany({ where: { userId } });

  if (branchIds.length > 0) {
    await prisma.userBranchScope.createMany({
      data: branchIds.map((branchId) => ({ userId, branchId })),
      skipDuplicates: true,
    });
  }
}

async function seedTenantUsers(input: {
  tenantId: string;
  preset: IndustryPreset;
  prefix: string;
  passwordHash: string;
  roleMap: Map<string, string>;
  branches: Array<{ id: string; name: string }>;
  includeSuperAdmin: boolean;
}) {
  const [ownerAccount, staffAccount] = await Promise.all([
    upsertAccount({
      email: 'owner@local.test',
      phone: '+1-555-0101',
      passwordHash: input.passwordHash,
    }),
    upsertAccount({
      email: 'staff@local.test',
      phone: '+1-555-0102',
      passwordHash: input.passwordHash,
    }),
  ]);

  const owner = await upsertUser({
    tenantId: input.tenantId,
    accountId: ownerAccount.id,
    email: ownerAccount.email,
    name: `${input.prefix} Owner`,
    phone: ownerAccount.phone,
    legacyRole: LegacyRole.OWNER,
    defaultBranchId: input.branches[0]?.id ?? null,
  });

  const staff = await upsertUser({
    tenantId: input.tenantId,
    accountId: staffAccount.id,
    email: staffAccount.email,
    name: `${input.prefix} Staff`,
    phone: staffAccount.phone,
    legacyRole: LegacyRole.STAFF,
    defaultBranchId: input.branches[0]?.id ?? null,
  });

  const ownerRoleId = input.roleMap.get(getLegacyRoleTemplateName(input.preset, LegacyRole.OWNER));
  const staffRoleId = input.roleMap.get(getLegacyRoleTemplateName(input.preset, LegacyRole.STAFF));

  await assignUserRoles(owner.id, ownerRoleId ? [ownerRoleId] : []);
  await assignUserRoles(staff.id, staffRoleId ? [staffRoleId] : []);
  await assignBranchScope(owner.id, []);
  await assignBranchScope(staff.id, input.branches[0] ? [input.branches[0].id] : []);

  let superAdmin: Awaited<ReturnType<typeof upsertUser>> | null = null;
  if (input.includeSuperAdmin) {
    const superAdminAccount = await upsertAccount({
      email: 'admin@local.test',
      phone: '+1-555-0001',
      passwordHash: input.passwordHash,
    });

    superAdmin = await upsertUser({
      tenantId: input.tenantId,
      accountId: superAdminAccount.id,
      email: superAdminAccount.email,
      name: 'Platform Super Admin',
      phone: superAdminAccount.phone,
      legacyRole: LegacyRole.OWNER,
      isSuperAdmin: true,
      isTenantAdmin: true,
    });

    const adminRoleId = input.roleMap.get(getAdminRoleName(input.preset));
    await assignUserRoles(superAdmin.id, adminRoleId ? [adminRoleId] : []);
    await assignBranchScope(superAdmin.id, []);
  }

  return { owner, staff, superAdmin };
}

async function seedGenericTenant(
  tenantId: string,
  ownerId: string,
  staffId: string,
  branches: Array<{ id: string }>,
): Promise<void> {
  const now = new Date();
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const inFiveHours = new Date(now.getTime() + 5 * 60 * 60 * 1000);

  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        tenantId,
        ownerId: staffId,
        branchId: branches[0]?.id ?? null,
        stageKey: 'NEW',
        name: 'Ahmad Rahman',
        email: 'ahmad.rahman@example.com',
        phone: '+1-555-1101',
        source: 'web',
        status: LeadStatus.NEW,
        nextFollowUpAt: inTwoHours,
      },
    }),
    prisma.lead.create({
      data: {
        tenantId,
        ownerId: staffId,
        branchId: branches[0]?.id ?? null,
        stageKey: 'PENDING',
        name: 'Fatimah Noor',
        email: 'fatimah.noor@example.com',
        phone: '+1-555-1102',
        source: 'referral',
        status: LeadStatus.PENDING,
        nextFollowUpAt: inFiveHours,
      },
    }),
    prisma.lead.create({
      data: {
        tenantId,
        ownerId,
        branchId: branches[0]?.id ?? null,
        stageKey: 'WON',
        name: 'Khalid Yusuf',
        email: 'khalid.yusuf@example.com',
        phone: '+1-555-1103',
        source: 'campaign',
        status: LeadStatus.WON,
        nextFollowUpAt: null,
      },
    }),
  ]);

  await Promise.all([
    prisma.followUp.create({
      data: {
        tenantId,
        leadId: leads[0].id,
        assignedTo: staffId,
        kind: 'GENERAL',
        scheduledAt: inTwoHours,
        note: 'Discovery call',
      },
    }),
    prisma.followUp.create({
      data: {
        tenantId,
        leadId: leads[1].id,
        assignedTo: staffId,
        kind: 'GENERAL',
        scheduledAt: inFiveHours,
        note: 'Send pricing options',
      },
    }),
  ]);

  await Promise.all(
    leads.map((lead) =>
      prisma.leadActivity.create({
        data: {
          tenantId,
          leadId: lead.id,
          actorId: ownerId,
          type: 'lead.seeded',
          message: 'Seed data created for Demo Generic tenant',
        },
      }),
    ),
  );
}

async function seedLabTenant(
  tenantId: string,
  ownerId: string,
  staffId: string,
  branches: Array<{ id: string }>,
): Promise<void> {
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  const inThreeHours = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const inTwoDays = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        tenantId,
        ownerId: staffId,
        branchId: branches[0]?.id ?? null,
        stageKey: 'ENQUIRY_RECEIVED',
        name: 'Mariam Siddiqui',
        email: 'mariam@example.com',
        phone: '+1-555-2201',
        source: 'whatsapp',
        intakeData: {
          testOrPackage: 'CBC',
          homeCollection: true,
          preferredSlot: inThreeHours.toISOString(),
          pincode: '560001',
          source: 'whatsapp',
        },
        status: LeadStatus.NEW,
        nextFollowUpAt: inOneHour,
      },
    }),
    prisma.lead.create({
      data: {
        tenantId,
        ownerId: staffId,
        branchId: branches[1]?.id ?? branches[0]?.id ?? null,
        stageKey: 'REPORT_DELIVERED',
        name: 'Noman Farooq',
        email: 'noman@example.com',
        phone: '+1-555-2202',
        source: 'web',
        intakeData: {
          testOrPackage: 'Diabetes Package',
          homeCollection: false,
          preferredSlot: inOneHour.toISOString(),
          pincode: '560048',
          source: 'web',
        },
        status: LeadStatus.WON,
        nextFollowUpAt: inTwoDays,
      },
    }),
  ]);

  await Promise.all([
    prisma.followUp.create({
      data: {
        tenantId,
        leadId: leads[0].id,
        assignedTo: staffId,
        kind: 'GENERAL',
        scheduledAt: inOneHour,
        note: 'Confirm sample collection slot',
      },
    }),
    prisma.followUp.create({
      data: {
        tenantId,
        leadId: leads[1].id,
        assignedTo: staffId,
        kind: 'POST_REPORT',
        scheduledAt: inTwoDays,
        note: 'Post-report follow-up call',
      },
    }),
  ]);

  await Promise.all([
    prisma.leadActivity.create({
      data: {
        tenantId,
        leadId: leads[0].id,
        actorId: ownerId,
        type: 'enquiry.created',
        message: 'Diagnostics enquiry captured from WhatsApp',
      },
    }),
    prisma.leadActivity.create({
      data: {
        tenantId,
        leadId: leads[1].id,
        actorId: ownerId,
        type: 'report.delivered',
        message: 'Report delivered milestone reached, follow-up scheduled.',
      },
    }),
  ]);
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Seeding HikmahOne LeadOps...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  await seedPermissionCatalog();

  const [demoLabTenant, demoGenericTenant] = await Promise.all([
    upsertTenantWithConfig({
      slug: 'demo-lab',
      name: 'Demo Lab',
      industryPreset: IndustryPreset.DIAGNOSTICS_LAB,
    }),
    upsertTenantWithConfig({
      slug: 'demo-generic',
      name: 'Demo Generic',
      industryPreset: IndustryPreset.GENERIC,
    }),
  ]);

  const [labRoleMap, genericRoleMap, labBranches, genericBranches] = await Promise.all([
    ensureTenantRoles(demoLabTenant.id, IndustryPreset.DIAGNOSTICS_LAB),
    ensureTenantRoles(demoGenericTenant.id, IndustryPreset.GENERIC),
    ensureTenantBranches(demoLabTenant.id, IndustryPreset.DIAGNOSTICS_LAB),
    ensureTenantBranches(demoGenericTenant.id, IndustryPreset.GENERIC),
  ]);

  const labUsers = await seedTenantUsers({
    tenantId: demoLabTenant.id,
    preset: IndustryPreset.DIAGNOSTICS_LAB,
    prefix: 'lab',
    passwordHash,
    roleMap: labRoleMap,
    branches: labBranches,
    includeSuperAdmin: true,
  });

  const genericUsers = await seedTenantUsers({
    tenantId: demoGenericTenant.id,
    preset: IndustryPreset.GENERIC,
    prefix: 'generic',
    passwordHash,
    roleMap: genericRoleMap,
    branches: genericBranches,
    includeSuperAdmin: false,
  });

  await prisma.followUp.deleteMany({
    where: { tenantId: { in: [demoLabTenant.id, demoGenericTenant.id] } },
  });
  await prisma.leadActivity.deleteMany({
    where: { tenantId: { in: [demoLabTenant.id, demoGenericTenant.id] } },
  });
  await prisma.lead.deleteMany({
    where: { tenantId: { in: [demoLabTenant.id, demoGenericTenant.id] } },
  });

  await Promise.all([
    seedLabTenant(demoLabTenant.id, labUsers.owner.id, labUsers.staff.id, labBranches),
    seedGenericTenant(demoGenericTenant.id, genericUsers.owner.id, genericUsers.staff.id, genericBranches),
  ]);

  // eslint-disable-next-line no-console
  console.log('Seed complete. Use these local credentials:');
  // eslint-disable-next-line no-console
  console.log('SUPER_ADMIN: admin@local.test or +1-555-0001 / Password123!');
  // eslint-disable-next-line no-console
  console.log('Shared OWNER (Demo Lab + Demo Generic): owner@local.test or +1-555-0101 / Password123!');
  // eslint-disable-next-line no-console
  console.log('Shared STAFF (Demo Lab + Demo Generic): staff@local.test or +1-555-0102 / Password123!');
  // eslint-disable-next-line no-console
  console.log('Choose a tenant after login for shared accounts with multiple memberships.');
  // eslint-disable-next-line no-console
  console.log(`Demo Lab tenant id: ${demoLabTenant.id}`);
  // eslint-disable-next-line no-console
  console.log(`Demo Generic tenant id: ${demoGenericTenant.id}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
