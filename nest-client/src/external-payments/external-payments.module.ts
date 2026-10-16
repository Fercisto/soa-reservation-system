import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { ExternalClientSettingsController } from './external-client-settings.controller.js';
import { ExternalPaymentsController } from './external-payments.controller.js';
import { ExternalPaymentsResolver } from './external-payments.resolver.js';
import { ExternalPaymentsService } from './external-payments.service.js';

@Module({
  imports: [HttpModule],
  controllers: [ExternalPaymentsController, ExternalClientSettingsController],
  providers: [ExternalPaymentsService, ExternalPaymentsResolver],
})
export class ExternalPaymentsModule {}
