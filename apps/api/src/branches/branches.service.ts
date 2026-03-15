import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Branch, CreateBranchDto, UpdateBranchDto } from '@leadops/shared';
import { AccessControlService } from '../access-control/access-control.service';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant.store';

@Injectable()
export class BranchesService {
  constructor(
    private readonly accessControl: AccessControlService,
    private readonly prisma: PrismaService,
  ) {}

  async findAll(): Promise<Branch[]> {
    const tenantId = getTenantContext()?.tenantId;
    const branches = await this.accessControl.listTenantBranches(tenantId ?? '', {
      includeInactive: true,
    });

    return branches.map((branch) => ({
      id: branch.id,
      tenantId: branch.tenantId,
      name: branch.name,
      description: branch.description,
      isActive: branch.isActive,
    }));
  }

  async create(dto: CreateBranchDto, actorId?: string): Promise<Branch> {
    const tenantId = getTenantContext()?.tenantId ?? '';

    const name = dto.name.trim();

    if (name.length < 2) {
      throw new BadRequestException('Branch name must be at least 2 characters');
    }

    try {
      const branch = await this.prisma.branch.create({
        data: {
          tenantId,
          name,
          description: this.normalizeDescription(dto.description),
        },
      });

      await this.prisma.tenantAuditEvent.create({
        data: {
          tenantId,
          actorId: actorId ?? null,
          entityType: 'BRANCH',
          entityId: branch.id,
          action: 'tenant.branch.created',
          metadata: {
            name: branch.name,
            description: branch.description,
            isActive: branch.isActive,
          },
        },
      });
      await this.accessControl.invalidateTenantUsers(tenantId);

      return {
        id: branch.id,
        tenantId: branch.tenantId,
        name: branch.name,
        description: branch.description,
        isActive: branch.isActive,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      ) {
        throw new BadRequestException('A branch with this name already exists');
      }

      throw error;
    }
  }

  async update(id: string, dto: UpdateBranchDto, actorId?: string): Promise<Branch> {
    const tenantId = getTenantContext()?.tenantId ?? '';

    const existing = await this.prisma.branch.findFirst({
      where: { id, tenantId },
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
      data.description = this.normalizeDescription(dto.description ?? undefined);
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No branch changes provided');
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
          actorId: actorId ?? null,
          entityType: 'BRANCH',
          entityId: branch.id,
          action: 'tenant.branch.updated',
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
      await this.accessControl.invalidateTenantUsers(tenantId);

      return {
        id: branch.id,
        tenantId: branch.tenantId,
        name: branch.name,
        description: branch.description,
        isActive: branch.isActive,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      ) {
        throw new BadRequestException('A branch with this name already exists');
      }

      throw error;
    }
  }

  private normalizeDescription(value: string | undefined): string | null {
    if (value === undefined) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}
