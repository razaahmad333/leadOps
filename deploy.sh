#!/bin/bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/apps/myapp}"
FAILED_MIGRATION_ID="20260315053726_abc"

dc() {
  docker compose "$@"
}

wait_for_postgres() {
  local retries=30
  local delay=2

  for ((i = 1; i <= retries; i++)); do
    if dc exec -T postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done

  echo "Postgres did not become ready in time."
  return 1
}

wait_for_redis() {
  local retries=30
  local delay=2

  for ((i = 1; i <= retries; i++)); do
    if dc exec -T redis redis-cli ping 2>/dev/null | grep -q "^PONG$"; then
      return 0
    fi
    sleep "$delay"
  done

  echo "Redis did not become ready in time."
  return 1
}

bootstrap_rbac_if_needed() {
  set +e
  dc run --rm -u root api node <<'EOF'
const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  try {
    const permissionCount = await prisma.permission.count();
    if (permissionCount > 0) {
      console.log(`RBAC baseline already exists (permissions=${permissionCount}).`);
      process.exit(0);
    }

    console.log('RBAC permission catalog is empty; bootstrap required.');
    process.exit(42);
  } finally {
    await prisma.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
EOF
  local check_rc=$?
  set -e

  if [[ $check_rc -eq 0 ]]; then
    return 0
  fi

  if [[ $check_rc -ne 42 ]]; then
    echo "RBAC pre-check failed."
    return "$check_rc"
  fi

  echo "Bootstrapping RBAC baseline..."
  dc run --rm -u root api node <<'EOF'
const { PrismaClient } = require('@prisma/client');
const { IndustryPreset } = require('@leadops/shared');
const {
  PERMISSION_CATALOG,
  getDefaultRoleTemplates,
} = require('./dist/access-control/permission-catalog');

const prisma = new PrismaClient();

const parsePreset = (value) => {
  return Object.values(IndustryPreset).includes(value) ? value : IndustryPreset.GENERIC;
};

(async () => {
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

  const permissions = await prisma.permission.findMany({
    select: { id: true, key: true },
  });
  const permissionMap = new Map(permissions.map((permission) => [permission.key, permission.id]));

  const tenants = await prisma.tenant.findMany({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  const configs = await prisma.tenantConfig.findMany({
    where: { tenantId: { in: tenants.map((tenant) => tenant.id) } },
    select: { tenantId: true, industryPreset: true },
  });
  const presetByTenantId = new Map(
    configs.map((config) => [config.tenantId, parsePreset(config.industryPreset)]),
  );

  let rolesProvisioned = 0;
  for (const tenant of tenants) {
    const preset = presetByTenantId.get(tenant.id) ?? IndustryPreset.GENERIC;
    for (const template of getDefaultRoleTemplates(preset)) {
      const role = await prisma.permissionRole.upsert({
        where: {
          tenantId_name: {
            tenantId: tenant.id,
            name: template.name,
          },
        },
        update: {
          description: template.description,
          isSystem: template.isSystem ?? false,
        },
        create: {
          tenantId: tenant.id,
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
        .filter((value) => Boolean(value));

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
  }

  console.log(
    `RBAC bootstrap complete: permissions=${permissions.length}, tenants=${tenants.length}, roles=${rolesProvisioned}`,
  );
})()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
EOF
}

cd "$APP_DIR"

echo "Pulling latest images..."
dc pull

echo "Starting infra dependencies..."
dc up -d postgres redis

echo "Waiting for Postgres..."
wait_for_postgres

echo "Waiting for Redis..."
wait_for_redis

echo "Running Prisma migrations..."
set +e
MIGRATE_OUTPUT="$(dc run --rm -u root api ./node_modules/.bin/prisma migrate deploy 2>&1)"
MIGRATE_RC=$?
set -e

if [[ $MIGRATE_RC -ne 0 ]]; then
  echo "$MIGRATE_OUTPUT"
  if [[ "$MIGRATE_OUTPUT" == *"P3009"* && "$MIGRATE_OUTPUT" == *"$FAILED_MIGRATION_ID"* ]]; then
    echo "Resolving failed migration ${FAILED_MIGRATION_ID} as applied and retrying..."
    dc run --rm -u root api ./node_modules/.bin/prisma migrate resolve --applied "$FAILED_MIGRATION_ID"
    dc run --rm -u root api ./node_modules/.bin/prisma migrate deploy
  else
    echo "Migration failed for a different reason. Exiting."
    exit "$MIGRATE_RC"
  fi
fi

echo "Checking RBAC baseline..."
bootstrap_rbac_if_needed

echo "Restarting services..."
dc up -d --remove-orphans

echo "Cleaning old images..."
docker image prune -af

echo "Done."
dc ps
