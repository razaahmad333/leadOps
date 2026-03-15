import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ListPlatformTenantOptionsQueryDto,
  ListPlatformTenantsQueryDto,
  PlatformAdminOverview,
  PlatformAdminSummary,
  PlatformTenantDetails,
  PlatformTenantDetailsQueryDto,
  PlatformTenantListResponse,
  PlatformTenantOption,
  PlatformTenantSortBySchema,
  PlatformSortOrderSchema,
  UserStatus,
} from '@leadops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { buildPaginatedResponse } from '../common/utils/pagination.util';
import { PlatformAdminSharedService } from './platform-admin.shared.service';

@Injectable()
export class PlatformAdminReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantConfig: TenantConfigService,
    private readonly shared: PlatformAdminSharedService,
  ) {}

  async getOverview(actor: { isSuperAdmin: boolean }): Promise<PlatformAdminOverview> {
    this.shared.ensureSuperAdmin(actor);

    const [tenants, accounts] = await Promise.all([
      this.prisma.tenant.findMany({
        include: {
          config: true,
          _count: {
            select: {
              users: true,
            },
          },
        },
        orderBy: [{ createdAt: 'asc' }],
      }),
      this.prisma.account.findMany({
        include: {
          users: {
            include: {
              tenant: true,
            },
            orderBy: [{ tenant: { name: 'asc' } }, { createdAt: 'asc' }],
          },
        },
        orderBy: [{ email: 'asc' }],
      }),
    ]);

    return {
      tenants: tenants.map((tenant) => this.shared.mapTenantSummary(tenant)),
      accounts: accounts.map((account) => ({
        id: account.id,
        email: account.email,
        phone: account.phone,
        status: account.status as UserStatus,
        membershipCount: account.users.length,
        memberships: account.users.map((user) => this.shared.mapMembershipSummary(user)),
      })),
      users: accounts.flatMap((account) =>
        account.users.map((user) =>
          this.shared.mapPlatformAdminUserSummary({
            userId: user.id,
            accountId: account.id,
            tenantId: user.tenantId,
            tenantName: user.tenant.name,
            tenantSlug: user.tenant.slug,
            name: user.name,
            email: account.email,
            phone: account.phone,
            role: user.role,
            isTenantAdmin: user.isTenantAdmin,
            isSuperAdmin: user.isSuperAdmin,
            status: user.status,
            accountStatus: account.status,
          }),
        ),
      ),
    };
  }

  async getSummary(actor: { isSuperAdmin: boolean }): Promise<PlatformAdminSummary> {
    this.shared.ensureSuperAdmin(actor);

    const [tenantCount, accountCount, membershipCount] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.account.count(),
      this.prisma.user.count(),
    ]);

    return {
      tenantCount,
      accountCount,
      membershipCount,
    };
  }

  async listTenants(
    actor: { isSuperAdmin: boolean },
    query: ListPlatformTenantsQueryDto,
  ): Promise<PlatformTenantListResponse> {
    this.shared.ensureSuperAdmin(actor);

    const page = query.page;
    const pageSize = query.pageSize;
    const search = query.q?.trim();
    const sortBy = PlatformTenantSortBySchema.parse(query.sortBy);
    const sortOrder = PlatformSortOrderSchema.parse(query.sortOrder);

    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { slug: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [total, raw] = await Promise.all([
      this.prisma.tenant.count({ where }),
      this.prisma.tenant.findMany({
        where,
        include: {
          config: true,
          _count: {
            select: {
              users: true,
            },
          },
        },
        orderBy: this.shared.resolveTenantOrderBy(sortBy, sortOrder),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return buildPaginatedResponse(raw.map((tenant) => this.shared.mapTenantSummary(tenant)), page, pageSize, total);
  }

  async listTenantOptions(
    actor: { isSuperAdmin: boolean },
    query: ListPlatformTenantOptionsQueryDto,
  ): Promise<PlatformTenantOption[]> {
    this.shared.ensureSuperAdmin(actor);

    const search = query.q?.trim();
    const options = await this.prisma.tenant.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { slug: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: [{ name: 'asc' }],
      take: query.limit,
    });

    return options.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
    }));
  }

  async getTenantDetails(
    actor: { isSuperAdmin: boolean },
    tenantId: string,
    query: PlatformTenantDetailsQueryDto = {},
  ): Promise<PlatformTenantDetails> {
    this.shared.ensureSuperAdmin(actor);

    const [tenant, settings, availableRoles] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          config: true,
          branches: {
            orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
          },
          _count: {
            select: {
              users: true,
              branches: true,
            },
          },
        },
      }),
      this.tenantConfig.getSettings(tenantId),
      this.prisma.permissionRole.findMany({
        where: {
          OR: [{ tenantId }, { tenantId: null }],
        },
        select: {
          id: true,
          name: true,
          isSystem: true,
        },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      }),
    ]);

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const paginateUsers = query.usersPage !== undefined || query.usersPageSize !== undefined;
    const usersPage = query.usersPage ?? 1;
    const usersPageSize = query.usersPageSize ?? 20;

    const usersResult = paginateUsers
      ? await this.shared.getPaginatedTenantUsers(tenantId, usersPage, usersPageSize)
      : await this.shared.getAllTenantUsers(tenantId);

    const paginateAudit = query.auditPage !== undefined || query.auditPageSize !== undefined;
    const auditPage = query.auditPage ?? 1;
    const auditPageSize = query.auditPageSize ?? 20;

    const auditResult = paginateAudit
      ? await this.shared.getPaginatedTenantAuditEvents(tenantId, auditPage, auditPageSize)
      : await this.shared.getAllTenantAuditEvents(tenantId);

    const activeBranches = tenant.branches
      .filter((branch) => branch.isActive)
      .map((branch) => ({
        id: branch.id,
        name: branch.name,
      }));

    return {
      tenant: {
        ...this.shared.mapTenantSummary(tenant),
        userCount: tenant._count.users,
        branchCount: tenant._count.branches,
        updatedAt: tenant.updatedAt.toISOString(),
      },
      settings,
      availableRoles: availableRoles.map((role) => ({
        id: role.id,
        name: role.name,
        isSystem: role.isSystem,
      })),
      users: usersResult.items.map((user) => this.shared.mapTenantUserDetail(user, activeBranches)),
      usersPage: usersResult.pageMeta,
      branches: tenant.branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        description: branch.description,
        isActive: branch.isActive,
        createdAt: branch.createdAt.toISOString(),
        updatedAt: branch.updatedAt.toISOString(),
      })),
      auditEvents: auditResult.items.map((event) => this.shared.mapTenantAuditEvent(event)),
      auditEventsPage: auditResult.pageMeta,
    };
  }
}
