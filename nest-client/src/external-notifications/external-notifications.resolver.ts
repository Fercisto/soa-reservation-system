import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { ApiKey, ApiKeyGuard } from '../common/api-key.guard.js';
import { ExternalNotificationsService } from './external-notifications.service.js';
import {
  ExternalNotification,
  ExternalNotificationList,
  SendExternalNotificationInput,
} from './external-notification.model.js';

/**
 * GraphQL entry point of the notifications service for external systems.
 * Requires the X-Api-Key header, which is forwarded to Laravel.
 */
@UseGuards(ApiKeyGuard)
@Resolver(() => ExternalNotification)
export class ExternalNotificationsResolver {
  constructor(
    private readonly notificationsService: ExternalNotificationsService,
  ) {}

  @Mutation(() => ExternalNotification, {
    description: 'Sends an in-app notification to a recipient of the calling system',
  })
  sendExternalNotification(
    @Args('input') input: SendExternalNotificationInput,
    @ApiKey() apiKey: string,
  ): Promise<ExternalNotification> {
    return this.notificationsService.send(input, apiKey);
  }

  @Query(() => ExternalNotificationList, {
    description: 'Notifications of one recipient, newest first, with the unread count',
  })
  externalNotifications(
    @Args('recipient') recipient: string,
    @ApiKey() apiKey: string,
    @Args('unreadOnly', { nullable: true }) unreadOnly?: boolean,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<ExternalNotificationList> {
    return this.notificationsService.findAll(
      { recipient, unread: unreadOnly, limit },
      apiKey,
    );
  }

  @Query(() => ExternalNotification)
  externalNotification(
    @Args('id', { type: () => ID }) id: string,
    @ApiKey() apiKey: string,
  ): Promise<ExternalNotification> {
    return this.notificationsService.findOne(id, apiKey);
  }

  @Mutation(() => ExternalNotification)
  markExternalNotificationAsRead(
    @Args('id', { type: () => ID }) id: string,
    @ApiKey() apiKey: string,
  ): Promise<ExternalNotification> {
    return this.notificationsService.markAsRead(id, apiKey);
  }

  @Mutation(() => Int, {
    description: 'Marks every unread notification of the recipient as read and returns how many changed',
  })
  async markAllExternalNotificationsAsRead(
    @Args('recipient') recipient: string,
    @ApiKey() apiKey: string,
  ): Promise<number> {
    const result = await this.notificationsService.markAllAsRead(
      recipient,
      apiKey,
    );
    return result.updated;
  }
}
