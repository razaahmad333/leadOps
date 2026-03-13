import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreatePlatformTenantRoleDto,
  PlatformTenantRole,
  UpdatePlatformTenantRoleDto,
} from '@leadops/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessControlService } from '../access-control/access-control.service';
import { PlatformAdminSharedService } from './platform-admin.shared.service';

@Injectable()
export class PlatformAdminRoleOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly shared: PlatformAdminSharedService,
  ) {}

  async listTenantRoles(
    actor: { isSuperAdmin: boolean },
    tenantId: string,
  ): Promise<PlatformTenantRole[]> {
    this.shared.ensureSuperAdmin(actor);
    await this.accessControl.ensureTenantInitialized(tenantId);
    await this.shared.ensureTenantExists(tenantId);

    const roles = await this.prisma.permissionRole.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    return roles.map((role) => this.shared.mapPlatformTenantRole(role));
  }

  async createTenantRole(
    actor: { isSuperAdmin: boolean; id: string },
    tenantId: string,
    dto: CreatePlatformTenantRoleDto,
  ): Promise<PlatformTenantRole> {
    this.shared.ensureSuperAdmin(actor);
    await this.accessControl.ensureTenantInitialized(tenantId);
    await this.shared.ensureTenantExists(tenantId);

    const name = dto.name.trim();
    if (name.length < 2) {
      throw new BadRequestException('Role name must be at least 2 characters');
    }

    const permissionIds = await this.shared.resolvePermissionIds(dto.permissionKeys);

    try {
      const role = await this.prisma.permissionRole.create({
        data: {
          tenantId,
          name,
          description: dto.description?.trim() || null,
          isSystem: false,
          rolePermissions: {
            create: permissionIds.map((permissionId) => ({
              permissionId,
            })),
          },
        },
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
          _count: {
            select: {
              userRoles: true,
            },
          },
        },
      });

      await this.prisma.tenantAuditEvent.create({
        data: {
          tenantId,
          actorId: actor.id,
          entityType: 'ROLE',
          entityId: role.id,
          action: 'platform.role.created',
          metadata: {
            name: role.name,
            description: role.description,
            permissionKeys: role.rolePermissions.map((entry) => entry.permission.key),
          },
        },
      });

      return this.shared.mapPlatformTenantRole(role);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('A role with this name already exists');
      }

      throw error;
    }
  }

  async updateTenantRole(
    actor: { isSuperAdmin: boolean; id: string },
    tenantId: string,
    roleId: string,
    dto: UpdatePlatformTenantRoleDto,
  ): Promise<PlatformTenantRole> {
    this.shared.ensureSuperAdmin(actor);
    await this.accessControl.ensureTenantInitialized(tenantId);
    await this.shared.ensureTenantExists(tenantId);

    const existing = await this.prisma.permissionRole.findFirst({
      where: {
        id: roleId,
        OR: [{ tenantId }, { tenantId: null }],
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    if (existing.tenantId !== tenantId) {
      throw new NotFoundException('Role not found');
    }

    if (existing.tenantId === null || existing.isSystem) {
      throw new ForbiddenException('System roles cannot be edited');
    }

    const trimmedName = dto.name?.trim();
    if (trimmedName !== undefined && trimmedName.length < 2) {
      throw new BadRequestException('Role name must be at least 2 characters');
    }

    const permissionIds = dto.permissionKeys !== undefined
      ? await this.shared.resolvePermissionIds(dto.permissionKeys)
      : undefined;

    try {
      await this.prisma.permissionRole.update({
        where: { id: existing.id },
        data: {
          name: trimmedName,
          description:
            dto.description === undefined
              ? undefined
              : dto.description?.trim() || null,
        },
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('A role with this name already exists');
      }

      throw error;
    }

    if (permissionIds !== undefined) {
      await this.prisma.rolePermission.deleteMany({
        where: { roleId: existing.id },
      });

      if (permissionIds.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: existing.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }
    }

    const updated = await this.prisma.permissionRole.findUniqueOrThrow({
      where: { id: existing.id },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            userRoles: true,
          },
        },
      },
    });

    await this.prisma.tenantAuditEvent.create({
      data: {
        tenantId,
        actorId: actor.id,
        entityType: 'ROLE',
        entityId: updated.id,
        action: 'platform.role.updated',
        metadata: {
          ...(dto.name !== undefined ? { name: { from: existing.name, to: updated.name } } : {}),
          ...(dto.description !== undefined ? { description: { from: existing.description, to: updated.description } } : {}),
          ...(dto.permissionKeys !== undefined
            ? {
                permissionKeys: {
                  from: existing.rolePermissions.map((entry) => entry.permission.key).sort(),
                  to: updated.rolePermissions.map((entry) => entry.permission.key).sort(),
                },
              }
            : {}),
        } as Prisma.InputJsonValue,
      },
    });

    return this.shared.mapPlatformTenantRole(updated);
  }
}
