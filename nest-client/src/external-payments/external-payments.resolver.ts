import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { ApiKey, ApiKeyGuard } from '../common/api-key.guard.js';
import { ExternalPaymentsService } from './external-payments.service.js';
import {
  CreateExternalPaymentInput,
  ExternalPayment,
} from './external-payment.model.js';

/**
 * GraphQL entry point of the payments service for external systems.
 * Requires the X-Api-Key header, which is forwarded to Laravel.
 */
@UseGuards(ApiKeyGuard)
@Resolver(() => ExternalPayment)
export class ExternalPaymentsResolver {
  constructor(private readonly paymentsService: ExternalPaymentsService) {}

  @Query(() => [ExternalPayment], {
    description: "Payments of the calling system (identified by X-Api-Key)",
  })
  externalPayments(
    @ApiKey() apiKey: string,
    @Args('reference', { nullable: true }) reference?: string,
    @Args('status', { nullable: true }) status?: string,
  ): Promise<ExternalPayment[]> {
    return this.paymentsService.findAll({ reference, status }, apiKey);
  }

  @Query(() => ExternalPayment)
  externalPayment(
    @Args('id', { type: () => ID }) id: string,
    @ApiKey() apiKey: string,
  ): Promise<ExternalPayment> {
    return this.paymentsService.findOne(id, apiKey);
  }

  @Mutation(() => ExternalPayment, {
    description:
      'Creates a payment and returns checkout_url. Calling it again with the same reference returns the open or paid payment.',
  })
  createExternalPayment(
    @Args('input') input: CreateExternalPaymentInput,
    @ApiKey() apiKey: string,
  ): Promise<ExternalPayment> {
    return this.paymentsService.create(input, apiKey);
  }

  @Mutation(() => ExternalPayment, {
    description: 'Asks Stripe for the current status of the payment',
  })
  verifyExternalPayment(
    @Args('id', { type: () => ID }) id: string,
    @ApiKey() apiKey: string,
  ): Promise<ExternalPayment> {
    return this.paymentsService.verify(id, apiKey);
  }

  @Mutation(() => ExternalPayment, {
    description: 'Closes the checkout of a pending payment',
  })
  cancelExternalPayment(
    @Args('id', { type: () => ID }) id: string,
    @ApiKey() apiKey: string,
  ): Promise<ExternalPayment> {
    return this.paymentsService.cancel(id, apiKey);
  }

  @Mutation(() => ExternalPayment, {
    description: 'Refunds a paid payment in full',
  })
  refundExternalPayment(
    @Args('id', { type: () => ID }) id: string,
    @ApiKey() apiKey: string,
  ): Promise<ExternalPayment> {
    return this.paymentsService.refund(id, apiKey);
  }
}
