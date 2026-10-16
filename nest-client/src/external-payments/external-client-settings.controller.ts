import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';

import { ApiKey, ApiKeyGuard } from '../common/api-key.guard.js';
import { UpdateExternalClientSettingsInput } from './external-payment.model.js';
import { ExternalPaymentsService } from './external-payments.service.js';

/**
 * REST entry point for an external system's own settings (Stripe key, callback URL).
 */
@UseGuards(ApiKeyGuard)
@Controller('v1/settings')
export class ExternalClientSettingsController {
  constructor(private readonly paymentsService: ExternalPaymentsService) {}

  @Get()
  show(@ApiKey() apiKey: string) {
    return this.paymentsService.getSettings(apiKey);
  }

  @Put()
  update(
    @Body() input: UpdateExternalClientSettingsInput,
    @ApiKey() apiKey: string,
  ) {
    return this.paymentsService.updateSettings(input, apiKey);
  }
}
