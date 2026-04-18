#!/usr/bin/env bash
set -euo pipefail

cd ~/apps/myapp

ADMIN_EMAIL="support@hikmahone.com"
ADMIN_PHONE="+1-555-1000"
ADMIN_PASSWORD='Ab1@0000'
TENANT_SLUG="hikmahone"
TENANT_NAME="Hikmah One"

[[ -n "${ADMIN_EMAIL}" ]] || { echo "ADMIN_EMAIL is required"; exit 1; }
[[ -n "${ADMIN_PASSWORD}" ]] || { echo "ADMIN_PASSWORD is required"; exit 1; }
[[ -n "${TENANT_SLUG}" ]] || { echo "TENANT_SLUG is required"; exit 1; }
[[ -n "${TENANT_NAME}" ]] || { echo "TENANT_NAME is required"; exit 1; }

docker compose run --rm -u root \
  -e ADMIN_EMAIL="${ADMIN_EMAIL}" \
  -e ADMIN_PHONE="${ADMIN_PHONE}" \
  -e ADMIN_PASSWORD="${ADMIN_PASSWORD}" \
  -e TENANT_SLUG="${TENANT_SLUG}" \
  -e TENANT_NAME="${TENANT_NAME}" \
  api node <<'EOF'
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { IndustryPreset } = require('@leadops/shared');
const { DEFAULT_TENANT_TIMEZONE } = require('./dist/tenant/tenant-defaults');
const { getPresetDisplayConfig } = require('./dist/tenant/tenant-presets');
const {
  PERMISSION_CATALOG,
  getDefaultRoleTemplates,
  getAdminRoleName,
} = require('./dist/access-control/permission-catalog');

const prisma = new PrismaClient();

(async () => {
  const required = ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'TENANT_SLUG', 'TENANT_NAME'];
  for (const key of required) {
    if (!process.env[key] || !process.env[key].trim()) {
      throw new Error(`Missing required env: ${key}`);
    }
  }

  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const phone = process.env.ADMIN_PHONE?.trim() || null;
  const password = process.env.ADMIN_PASSWORD;
  const tenantSlug = process.env.TENANT_SLUG.trim().toLowerCase();
  const tenantName = process.env.TENANT_NAME.trim();
  const preset = IndustryPreset.GENERIC;

  for (const p of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description, group: p.group },
      create: p,
    });
  }

  const tenant = await prisma.tenant.upsert({
    where: { slug: tenantSlug },
    update: { name: tenantName },
    create: { slug: tenantSlug, name: tenantName },
  });

  const displayConfig = getPresetDisplayConfig(preset);
  await prisma.tenantConfig.upsert({
    where: { tenantId: tenant.id },
    update: {
      industryPreset: preset,
      configVersion: 1,
      displayConfig,
      stages: displayConfig.pipelineConfig.stages.map((s) => s.label),
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
      industryPreset: preset,
      configVersion: 1,
      displayConfig,
      timezone: DEFAULT_TENANT_TIMEZONE,
      businessStart: '09:00',
      businessEnd: '18:00',
      stages: displayConfig.pipelineConfig.stages.map((s) => s.label),
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

  const allPerms = await prisma.permission.findMany({ select: { id: true, key: true } });
  const permMap = new Map(allPerms.map((x) => [x.key, x.id]));
  let adminRoleId = null;

  for (const tpl of getDefaultRoleTemplates(preset)) {
    const role = await prisma.permissionRole.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: tpl.name } },
      update: { description: tpl.description, isSystem: tpl.isSystem ?? false },
      create: {
        tenantId: tenant.id,
        name: tpl.name,
        description: tpl.description,
        isSystem: tpl.isSystem ?? false,
      },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const permissionIds = tpl.permissionKeys.map((k) => permMap.get(k)).filter(Boolean);
    if (permissionIds.length) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }

    if (tpl.name === getAdminRoleName(preset)) adminRoleId = role.id;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const existingByEmail = await prisma.account.findUnique({ where: { email } });
  const existingByPhone = phone ? await prisma.account.findUnique({ where: { phone } }) : null;
  const account = existingByEmail
    ?? existingByPhone
    ?? await prisma.account.create({ data: { email, phone, passwordHash, status: 'ACTIVE' } });

  if (existingByEmail || existingByPhone) {
    await prisma.account.update({
      where: { id: account.id },
      data: { email, phone, passwordHash, status: 'ACTIVE' },
    });
  }

  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: {
      accountId: account.id,
      name: 'Platform Super Admin',
      phone,
      role: 'OWNER',
      isSuperAdmin: true,
      isTenantAdmin: true,
      status: 'ACTIVE',
    },
    create: {
      tenantId: tenant.id,
      accountId: account.id,
      email,
      name: 'Platform Super Admin',
      phone,
      role: 'OWNER',
      isSuperAdmin: true,
      isTenantAdmin: true,
      status: 'ACTIVE',
    },
  });

  if (adminRoleId) {
    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: adminRoleId } });
  }

  console.log('Bootstrap complete');
  console.log('tenantId=', tenant.id);
  console.log('email=', email);
})()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => prisma.$disconnect());
EOF
