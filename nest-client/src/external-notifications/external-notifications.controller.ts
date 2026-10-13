import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ApiKey, ApiKeyGuard } from '../common/api-key.guard.js';
import { SendExternalNotificationInput } from './external-notification.model.js';
import { ExternalNotificationsService } from './external-notifications.service.js';
import type { ExternalNotificationFilters } from './external-notifications.service.js';

/**
 * REST entry point of the notifications service for external systems.
 * Every request is forwarded to Laravel's /api/v1/notifications with the same X-Api-Key.
 */
@UseGuards(ApiKeyGuard)
@Controller('v1/notifications')
export class ExternalNotificationsController {
  constructor(
    private readonly notificationsService: ExternalNotificationsService,
  ) {}

  @Post()
  send(
    @Body() input: SendExternalNotificationInput,
    @ApiKey() apiKey: string,
  ) {
    return this.notificationsService.send(input, apiKey);
  }

  @Get()
  findAll(
    @Query() filters: ExternalNotificationFilters,
    @ApiKey() apiKey: string,
  ) {
    return this.notificationsService.findAll(filters, apiKey);
  }

  // Declared before ':id' so "read-all" is not taken as an id.
  @Patch('read-all')
  markAllAsRead(
    @Body('recipient') recipient: string,
    @ApiKey() apiKey: string,
  ) {
    return this.notificationsService.markAllAsRead(recipient, apiKey);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @ApiKey() apiKey: string) {
    return this.notificationsService.findOne(id, apiKey);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @ApiKey() apiKey: string) {
    return this.notificationsService.markAsRead(id, apiKey);
  }
}
