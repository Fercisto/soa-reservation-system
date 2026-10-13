import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { ExternalNotificationsController } from './external-notifications.controller.js';
import { ExternalNotificationsResolver } from './external-notifications.resolver.js';
import { ExternalNotificationsService } from './external-notifications.service.js';

@Module({
  imports: [HttpModule],
  controllers: [ExternalNotificationsController],
  providers: [ExternalNotificationsService, ExternalNotificationsResolver],
})
export class ExternalNotificationsModule {}
