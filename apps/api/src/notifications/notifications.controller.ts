import { Body, Controller, Get, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthUser,
  type ListNotificationsQueryDto,
  ListNotificationsQuerySchema,
  type MarkNotificationReadDto,
  MarkNotificationReadSchema,
  NotificationListResponse,
  type NotificationMutationResult,
  type UnreadNotificationCount,
} from '@leadops/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications for the current user' })
  listNotifications(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(ListNotificationsQuerySchema)) query: ListNotificationsQueryDto,
  ): Promise<NotificationListResponse> {
    return this.notifications.listForUser(user, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count for the current user' })
  getUnreadCount(@CurrentUser() user: AuthUser): Promise<UnreadNotificationCount> {
    return this.notifications.getUnreadCount(user);
  }

  @Patch('read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(MarkNotificationReadSchema)) dto: MarkNotificationReadDto,
  ): Promise<NotificationMutationResult> {
    return this.notifications.markRead(user, dto);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() user: AuthUser): Promise<NotificationMutationResult> {
    return this.notifications.markAllRead(user);
  }
}
