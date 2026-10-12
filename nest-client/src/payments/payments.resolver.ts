import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UnauthorizedException, UseGuards } from '@nestjs/common';

import { PaymentsService } from './payments.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuthToken } from '../auth/auth.decorator.js';
import { Payment } from './models/payment.model.js';
import { CreatePaymentInput } from './dto/payment.inputs.js';

@UseGuards(AuthGuard)
@Resolver(() => Payment)
export class PaymentsResolver {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Query(() => [Payment], {
    name: 'payments',
    description: 'Own payments (admin: all payments)',
  })
  async getPayments(
    @Args('status', { nullable: true }) status?: string,
    @Args('reservationId', { type: () => Int, nullable: true })
    reservationId?: number,
    @CurrentAuthToken() token?: string,
  ): Promise<Payment[]> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.paymentsService.findAll(
      { status, reservation_id: reservationId },
      token,
    );
  }

  @Query(() => Payment, { name: 'payment', nullable: true })
  async getPayment(
    @Args('id', { type: () => ID }) id: string,
    @CurrentAuthToken() token?: string,
  ): Promise<Payment> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.paymentsService.findOne(id, token);
  }

  @Mutation(() => Payment, {
    description:
      'Card: returns a pending payment with checkout_url. Cash (admin): returns a paid payment.',
  })
  async createPayment(
    @Args('input') input: CreatePaymentInput,
    @CurrentAuthToken() token?: string,
  ): Promise<Payment> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.paymentsService.create(input, token);
  }

  @Mutation(() => Payment, {
    description: 'Checks the payment status with the provider and confirms the reservation if paid',
  })
  async verifyPayment(
    @Args('id', { type: () => ID }) id: string,
    @CurrentAuthToken() token?: string,
  ): Promise<Payment> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.paymentsService.verify(id, token);
  }
}
