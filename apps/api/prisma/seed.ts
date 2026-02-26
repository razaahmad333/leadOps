import { PrismaClient, LeadStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Seeding HikmahOne LeadOps...');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'local' },
    update: { name: 'HikmahOne Local Tenant' },
    create: {
      slug: 'local',
      name: 'HikmahOne Local Tenant',
    },
  });

  await prisma.tenantConfig.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      timezone: 'Asia/Jakarta',
      businessStart: '09:00',
      businessEnd: '18:00',
      stages: ['New', 'Contacted', 'Qualified', 'Pending', 'Won', 'Lost'],
      reminderRules: {
        firstReminderMinutes: 30,
        escalationMinutes: 120,
      },
      templates: [
        {
          key: 'initial_followup',
          title: 'Initial Follow-up',
          body: 'Assalamualaikum, just checking in regarding your request.',
        },
      ],
      featureFlags: {
        aiAssist: true,
      },
    },
  });

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'owner@local.test' } },
    update: { name: 'HikmahOne Owner', passwordHash, role: 'OWNER' },
    create: {
      tenantId: tenant.id,
      email: 'owner@local.test',
      name: 'HikmahOne Owner',
      passwordHash,
      role: 'OWNER',
    },
  });

  const staff = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'staff@local.test' } },
    update: { name: 'HikmahOne Staff', passwordHash, role: 'STAFF' },
    create: {
      tenantId: tenant.id,
      email: 'staff@local.test',
      name: 'HikmahOne Staff',
      passwordHash,
      role: 'STAFF',
    },
  });

  await prisma.followUp.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.leadActivity.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.lead.deleteMany({ where: { tenantId: tenant.id } });

  const now = new Date();
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const inFiveHours = new Date(now.getTime() + 5 * 60 * 60 * 1000);

  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        tenantId: tenant.id,
        ownerId: staff.id,
        name: 'Ahmad Rahman',
        email: 'ahmad.rahman@example.com',
        phone: '+1-555-1101',
        source: 'Website Form',
        status: LeadStatus.NEW,
        nextFollowUpAt: inTwoHours,
      },
    }),
    prisma.lead.create({
      data: {
        tenantId: tenant.id,
        ownerId: staff.id,
        name: 'Fatimah Noor',
        email: 'fatimah.noor@example.com',
        phone: '+1-555-1102',
        source: 'Referral',
        status: LeadStatus.PENDING,
        nextFollowUpAt: inFiveHours,
      },
    }),
    prisma.lead.create({
      data: {
        tenantId: tenant.id,
        ownerId: owner.id,
        name: 'Khalid Yusuf',
        email: 'khalid.yusuf@example.com',
        phone: '+1-555-1103',
        source: 'Campaign',
        status: LeadStatus.WON,
        nextFollowUpAt: null,
      },
    }),
  ]);

  await Promise.all([
    prisma.followUp.create({
      data: {
        tenantId: tenant.id,
        leadId: leads[0].id,
        assignedTo: staff.id,
        scheduledAt: inTwoHours,
        note: 'Discovery call',
      },
    }),
    prisma.followUp.create({
      data: {
        tenantId: tenant.id,
        leadId: leads[1].id,
        assignedTo: staff.id,
        scheduledAt: inFiveHours,
        note: 'Send pricing options',
      },
    }),
  ]);

  await Promise.all(
    leads.map((lead) =>
      prisma.leadActivity.create({
        data: {
          tenantId: tenant.id,
          leadId: lead.id,
          actorId: owner.id,
          type: 'lead.seeded',
          message: 'Seed data created for local development',
        },
      }),
    ),
  );

  // eslint-disable-next-line no-console
  console.log('Seed complete. Use these local credentials:');
  // eslint-disable-next-line no-console
  console.log('OWNER: owner@local.test / Password123!');
  // eslint-disable-next-line no-console
  console.log('STAFF: staff@local.test / Password123!');
  // eslint-disable-next-line no-console
  console.log(`SINGLE_TENANT_ID=${tenant.id}`);
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
