import { Injectable } from '@nestjs/common';
import {
  AuthUser,
  type ListNotificationsQueryDto,
  type MarkNotificationReadDto,
  type Notification,
  NotificationListResponse,
  type NotificationMutationResult,
  type UnreadNotificationCount,
} from '@leadops/shared';
import { Prisma } from '@prisma/client';
import { buildPaginatedResponse } from '../common/utils/pagination.util';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(
    user: AuthUser,
    query: ListNotificationsQueryDto,
  ): Promise<NotificationListResponse> {
    const where: Prisma.NotificationWhereInput = {
      tenantId: user.tenantId,
      userId: user.id,
      ...(query.status === 'unread'
        ? { readAt: null }
        : query.status === 'read'
          ? { readAt: { not: null } }
          : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return buildPaginatedResponse(items as Notification[], query.page, query.pageSize, total);
  }

  async getUnreadCount(user: AuthUser): Promise<UnreadNotificationCount> {
    const count = await this.prisma.notification.count({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
        readAt: null,
      },
    });

    return { count };
  }

  async markRead(user: AuthUser, dto: MarkNotificationReadDto): Promise<NotificationMutationResult> {
    const updated = await this.prisma.notification.updateMany({
      where: {
        id: dto.notificationId,
        tenantId: user.tenantId,
        userId: user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { success: updated.count > 0 };
  }

  async markAllRead(user: AuthUser): Promise<NotificationMutationResult> {
    await this.prisma.notification.updateMany({
      where: {
        tenantId: user.tenantId,
        userId: user.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return { success: true };
  }
}
