import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ApiKey, ApiKeyGuard } from '../common/api-key.guard.js';
import { CreateExternalPaymentInput } from './external-payment.model.js';
import { ExternalPaymentsService } from './external-payments.service.js';
import type { ExternalPaymentFilters } from './external-payments.service.js';

/**
 * REST entry point of the payments service for external systems.
 * Every request is forwarded to Laravel's /api/v1/payments with the same X-Api-Key.
 */
@UseGuards(ApiKeyGuard)
@Controller('v1/payments')
export class ExternalPaymentsController {
  constructor(private readonly paymentsService: ExternalPaymentsService) {}

  @Get()
  findAll(@Query() filters: ExternalPaymentFilters, @ApiKey() apiKey: string) {
    return this.paymentsService.findAll(filters, apiKey);
  }

  @Post()
  create(@Body() input: CreateExternalPaymentInput, @ApiKey() apiKey: string) {
    return this.paymentsService.create(input, apiKey);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @ApiKey() apiKey: string) {
    return this.paymentsService.findOne(id, apiKey);
  }

  @Post(':id/verify')
  @HttpCode(200)
  verify(@Param('id') id: string, @ApiKey() apiKey: string) {
    return this.paymentsService.verify(id, apiKey);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Param('id') id: string, @ApiKey() apiKey: string) {
    return this.paymentsService.cancel(id, apiKey);
  }

  @Post(':id/refund')
  @HttpCode(200)
  refund(@Param('id') id: string, @ApiKey() apiKey: string) {
    return this.paymentsService.refund(id, apiKey);
  }
}
