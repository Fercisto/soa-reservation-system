import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UnauthorizedException, UseGuards } from '@nestjs/common';

import { NotificationsService } from './notifications.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuthToken } from '../auth/auth.decorator.js';
import {
  AppNotification,
  NotificationList,
} from './models/notification.model.js';

@UseGuards(AuthGuard)
@Resolver(() => AppNotification)
export class NotificationsResolver {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Query(() => NotificationList, {
    name: 'notifications',
    description: 'Notifications of the current user, newest first',
  })
  async getNotifications(
    @Args('unreadOnly', { nullable: true }) unreadOnly?: boolean,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
    @CurrentAuthToken() token?: string,
  ): Promise<NotificationList> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.notificationsService.findAll(
      { unread: unreadOnly, limit },
      token,
    );
  }

  @Mutation(() => AppNotification)
  async markNotificationAsRead(
    @Args('id', { type: () => ID }) id: string,
    @CurrentAuthToken() token?: string,
  ): Promise<AppNotification> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.notificationsService.markAsRead(id, token);
  }

  @Mutation(() => Int, {
    description: 'Marks every unread notification as read and returns how many changed',
  })
  async markAllNotificationsAsRead(
    @CurrentAuthToken() token?: string,
  ): Promise<number> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    const result = await this.notificationsService.markAllAsRead(token);
    return result.updated;
  }
}
