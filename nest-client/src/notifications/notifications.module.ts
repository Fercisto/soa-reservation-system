import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { AuthModule } from '../auth/auth.module.js';
import { NotificationsService } from './notifications.service.js';
import { NotificationsResolver } from './notifications.resolver.js';

@Module({
  imports: [HttpModule, AuthModule],
  providers: [NotificationsService, NotificationsResolver],
  exports: [NotificationsService],
})
export class NotificationsModule {}
