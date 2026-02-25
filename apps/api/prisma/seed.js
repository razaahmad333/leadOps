"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt = __importStar(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
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
        { name: 'Alice Johnson', email: 'alice@example.com', phone: '+1-555-0001', source: 'Website', status: 'NEW' },
        { name: 'Bob Smith', email: 'bob@example.com', phone: '+1-555-0002', source: 'Referral', status: 'CONTACTED' },
        { name: 'Carol Davis', email: 'carol@example.com', phone: null, source: 'LinkedIn', status: 'QUALIFIED' },
    ];
    const leads = await Promise.all(leadData.map((data) => prisma.lead.create({ data: { ...data, tenantId: tenant.id } })));
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
//# sourceMappingURL=seed.js.map