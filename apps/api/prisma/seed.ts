import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  // ─────────────────────────────────────────
  // Tenant
  // ─────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'local' },
    update: {},
    create: {
      slug: 'local',
      name: 'Local Development Tenant',
    },
  });
  console.log(`✅ Tenant: ${tenant.id} (${tenant.slug})`);

  // ─────────────────────────────────────────
  // Users
  // ─────────────────────────────────────────
  const ownerHash = await bcrypt.hash('Password123!', 10);
  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'owner@local.test' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'owner@local.test',
      name: 'Local Owner',
      passwordHash: ownerHash,
      role: 'OWNER',
    },
  });
  console.log(`✅ Owner: ${owner.email}`);

  const staffHash = await bcrypt.hash('Password123!', 10);
  const staff = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'staff@local.test' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'staff@local.test',
      name: 'Local Staff',
      passwordHash: staffHash,
      role: 'STAFF',
    },
  });
  console.log(`✅ Staff: ${staff.email}`);

  // ─────────────────────────────────────────
  // Sample Leads
  // ─────────────────────────────────────────
  const leadData = [
    { name: 'Alice Johnson', email: 'alice@example.com', phone: '+1-555-0001', source: 'Website', status: 'NEW' as const },
    { name: 'Bob Smith', email: 'bob@example.com', phone: '+1-555-0002', source: 'Referral', status: 'CONTACTED' as const },
    { name: 'Carol Davis', email: 'carol@example.com', phone: null, source: 'LinkedIn', status: 'QUALIFIED' as const },
  ];

  const leads = await Promise.all(
    leadData.map((data) =>
      prisma.lead.create({ data: { ...data, tenantId: tenant.id } }),
    ),
  );
  console.log(`✅ Created ${leads.length} sample leads`);

  // ─────────────────────────────────────────
  // Follow-up due today
  // ─────────────────────────────────────────
  const today = new Date();
  today.setHours(10, 0, 0, 0);

  await prisma.followUp.create({
    data: {
      tenantId: tenant.id,
      leadId: leads[0].id,
      assignedTo: staff.id,
      scheduledAt: today,
      note: 'Initial discovery call',
    },
  });
  console.log('✅ Created follow-up due today');

  // Print tenant ID for use in SINGLE_TENANT_ID / VITE_TENANT_ID
  console.log('\n─────────────────────────────────────');
  console.log(`📋 Tenant UUID (copy to .env files):`);
  console.log(`   SINGLE_TENANT_ID=${tenant.id}`);
  console.log(`   VITE_TENANT_ID=${tenant.id}`);
  console.log('─────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
