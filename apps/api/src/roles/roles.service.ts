import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateRoleDto, RoleDetail, RoleSummary, UpdateRoleDto } from '@leadops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext } from '../tenant/tenant.store';
import { AccessControlService } from '../access-control/access-control.service';

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  async findAll(): Promise<RoleSummary[]> {
    const tenantId = getTenantContext()?.tenantId ?? '';
    await this.accessControl.ensureTenantInitialized(tenantId);

    const roles = await this.prisma.permissionRole.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
      },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: {
          select: { userRoles: true },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissionKeys: role.rolePermissions.map((entry) => entry.permission.key).sort(),
      userCount: role._count.userRoles,
    }));
  }

  async findOne(id: string): Promise<RoleDetail> {
    const role = await this.getTenantRole(id);

    return {
      id: role.id,
      tenantId: role.tenantId,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissionKeys: role.rolePermissions.map((entry) => entry.permission.key).sort(),
      userCount: role._count.userRoles,
    };
  }

  async create(dto: CreateRoleDto): Promise<RoleDetail> {
    const tenantId = getTenantContext()?.tenantId ?? '';
    await this.accessControl.ensureTenantInitialized(tenantId);

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: dto.permissionKeys } },
    });

    if (permissions.length !== dto.permissionKeys.length) {
      throw new BadRequestException('One or more permission keys are invalid');
    }

    const exists = await this.prisma.permissionRole.findFirst({
      where: { tenantId, name: dto.name.trim() },
    });

    if (exists) {
      throw new BadRequestException('A role with this name already exists');
    }

    const role = await this.prisma.permissionRole.create({
      data: {
        tenantId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        isSystem: false,
        rolePermissions: {
          create: permissions.map((permission) => ({
            permissionId: permission.id,
          })),
        },
      },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: {
          select: { userRoles: true },
        },
      },
    });

    return {
      id: role.id,
      tenantId: role.tenantId,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      permissionKeys: role.rolePermissions.map((entry) => entry.permission.key).sort(),
      userCount: role._count.userRoles,
    };
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleDetail> {
    const role = await this.getTenantRole(id);
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be edited');
    }

    let permissionIds: string[] | undefined;
    if (dto.permissionKeys) {
      const permissions = await this.prisma.permission.findMany({
        where: { key: { in: dto.permissionKeys } },
      });

      if (permissions.length !== dto.permissionKeys.length) {
        throw new BadRequestException('One or more permission keys are invalid');
      }

      permissionIds = permissions.map((permission) => permission.id);
    }

    await this.prisma.permissionRole.update({
      where: { id: role.id },
      data: {
        name: dto.name?.trim(),
        description:
          dto.description === undefined
            ? undefined
            : dto.description?.trim() || null,
      },
    });

    if (permissionIds) {
      await this.prisma.rolePermission.deleteMany({
        where: { roleId: role.id },
      });

      if (permissionIds.length > 0) {
        await this.prisma.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            roleId: role.id,
            permissionId,
          })),
          skipDuplicates: true,
        });
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const role = await this.getTenantRole(id);
    if (role.isSystem) {
      throw new ForbiddenException('System roles cannot be deleted');
    }

    if (role._count.userRoles > 0) {
      throw new BadRequestException('This role is assigned to one or more users');
    }

    await this.prisma.permissionRole.delete({ where: { id: role.id } });
  }

  private async getTenantRole(id: string) {
    const tenantId = getTenantContext()?.tenantId ?? '';
    await this.accessControl.ensureTenantInitialized(tenantId);

    const role = await this.prisma.permissionRole.findFirst({
      where: {
        id,
        OR: [{ tenantId }, { tenantId: null }],
      },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: {
          select: { userRoles: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.tenantId === null) {
      throw new ForbiddenException('Global templates are read-only');
    }

    return role;
  }
}
