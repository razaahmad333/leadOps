import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CreateBranchDto,
  CreateTenantDto,
  IndustryPreset,
  PlatformTenantDetails,
  PlatformTenantSummary,
  TenantSettings,
  UpdateBranchDto,
  UpdateTenantSettingsDto,
} from '@leadops/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { TenantConfigService } from '../tenant/tenant-config.service';
import { normalizePhoneNumber } from '../common/utils/phone.util';
import { PlatformAdminSharedService } from './platform-admin.shared.service';

@Injectable()
export class PlatformAdminTenantOpsService {
  private readonly logger = new Logger(PlatformAdminTenantOpsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly tenantConfig: TenantConfigService,
    private readonly shared: PlatformAdminSharedService,
  ) {}

  async updateTenantSettings(
    actor: { isSuperAdmin: boolean; id: string },
    tenantId: string,
    dto: UpdateTenantSettingsDto,
  ): Promise<TenantSettings> {
    this.shared.ensureSuperAdmin(actor);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.tenantConfig.updateSettings(dto, tenantId, actor.id);
  }

  async createTenantBranch(
    actor: { isSuperAdmin: boolean; id: string },
    tenantId: string,
    dto: CreateBranchDto,
  ): Promise<PlatformTenantDetails['branches'][number]> {
    this.shared.ensureSuperAdmin(actor);
    await this.accessControl.ensureTenantInitialized(tenantId);
    await this.shared.ensureTenantExists(tenantId);

    const name = dto.name.trim();
    if (name.length < 2) {
      throw new BadRequestException('Branch name must be at least 2 characters');
    }
    const description = this.shared.normalizeDescription(dto.description);

    try {
      const branch = await this.prisma.branch.create({
        data: {
          tenantId,
          name,
          description,
        },
      });

      await this.prisma.tenantAuditEvent.create({
        data: {
          tenantId,
          actorId: actor.id,
          entityType: 'BRANCH',
          entityId: branch.id,
          action: 'platform.branch.created',
          metadata: {
            name: branch.name,
            description: branch.description,
            isActive: branch.isActive,
          },
        },
      });

      return {
        id: branch.id,
        name: branch.name,
        description: branch.description,
        isActive: branch.isActive,
        createdAt: branch.createdAt.toISOString(),
        updatedAt: branch.updatedAt.toISOString(),
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('A branch with this name already exists');
      }

      throw error;
    }
  }

  async updateTenantBranch(
    actor: { isSuperAdmin: boolean; id: string },
    tenantId: string,
    branchId: string,
    dto: UpdateBranchDto,
  ): Promise<PlatformTenantDetails['branches'][number]> {
    this.shared.ensureSuperAdmin(actor);
    await this.accessControl.ensureTenantInitialized(tenantId);

    const existing = await this.prisma.branch.findFirst({
      where: {
        id: branchId,
        tenantId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Branch not found');
    }

    const data: Prisma.BranchUpdateInput = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name.length < 2) {
        throw new BadRequestException('Branch name must be at least 2 characters');
      }
      data.name = name;
    }
    if (dto.description !== undefined) {
      data.description = this.shared.normalizeDescription(dto.description ?? undefined);
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    try {
      const branch = await this.prisma.branch.update({
        where: { id: existing.id },
        data,
      });

      const metadata: Record<string, unknown> = {};
      if (dto.name !== undefined) {
        metadata.name = { from: existing.name, to: branch.name };
      }
      if (dto.description !== undefined) {
        metadata.description = { from: existing.description, to: branch.description };
      }
      if (dto.isActive !== undefined) {
        metadata.isActive = { from: existing.isActive, to: branch.isActive };
      }

      await this.prisma.tenantAuditEvent.create({
        data: {
          tenantId,
          actorId: actor.id,
          entityType: 'BRANCH',
          entityId: branch.id,
          action: 'platform.branch.updated',
          metadata: metadata as Prisma.InputJsonValue,
        },
      });

      return {
        id: branch.id,
        name: branch.name,
        description: branch.description,
        isActive: branch.isActive,
        createdAt: branch.createdAt.toISOString(),
        updatedAt: branch.updatedAt.toISOString(),
      };
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('A branch with this name already exists');
      }

      throw error;
    }
  }

  async createTenant(
    actor: { isSuperAdmin: boolean; id?: string },
    dto: CreateTenantDto,
  ): Promise<PlatformTenantSummary> {
    this.shared.ensureSuperAdmin(actor);

    const slug = dto.slug.trim().toLowerCase();
    const tenantName = dto.name.trim();
    const adminName = dto.adminName.trim();
    const adminEmail = dto.adminEmail.trim().toLowerCase();
    const adminPhone = normalizePhoneNumber(dto.adminPhone) || null;

    const existing = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new BadRequestException('A tenant with this slug already exists');
    }

    await this.shared.validateAccountIdentityForMembership(adminEmail, adminPhone);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: tenantName,
        slug,
      },
    });

    try {
      await this.shared.createTenantConfig(tenant.id, dto.industryPreset as IndustryPreset);
      this.tenantConfig.invalidate(tenant.id);
      await this.accessControl.ensureTenantInitialized(tenant.id);

      await this.shared.createMembershipRecord({
        tenantId: tenant.id,
        name: adminName,
        email: adminEmail,
        phone: adminPhone ?? undefined,
        password: dto.adminPassword,
        isTenantAdmin: true,
      }, actor.id);

      await this.prisma.tenantAuditEvent.create({
        data: {
          tenantId: tenant.id,
          actorId: actor.id ?? null,
          entityType: 'TENANT',
          entityId: tenant.id,
          action: 'platform.tenant.created',
          metadata: {
            slug,
            name: tenantName,
            industryPreset: dto.industryPreset,
          },
        },
      });
    } catch (error) {
      try {
        await this.prisma.tenant.delete({
          where: { id: tenant.id },
        });
      } catch (cleanupError) {
        this.logger.error(
          `Failed to rollback tenant ${tenant.id} after createTenant error: ${
            cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error'
          }`,
        );
      } finally {
        this.tenantConfig.invalidate(tenant.id);
      }

      throw error;
    }

    const created = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenant.id },
      include: {
        config: true,
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    return {
      ...this.shared.mapTenantSummary(created),
    };
  }
}
