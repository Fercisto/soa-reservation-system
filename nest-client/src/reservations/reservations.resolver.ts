import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UnauthorizedException, UseGuards } from '@nestjs/common';

import { ReservationsService } from './reservations.service.js';
import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuthToken } from '../auth/auth.decorator.js';
import { Reservation } from './models/reservation.model.js';
import {
  CreateReservationInput,
  UpdateReservationDatesInput,
} from './dto/reservation.inputs.js';

@UseGuards(AuthGuard)
@Resolver(() => Reservation)
export class ReservationsResolver {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Query(() => [Reservation], { name: 'reservations' })
  async getReservations(
    @CurrentAuthToken() token?: string,
  ): Promise<Reservation[]> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.reservationsService.findAll(token);
  }

  @Query(() => Reservation, { name: 'reservation', nullable: true })
  async getReservation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentAuthToken() token?: string,
  ): Promise<Reservation> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.reservationsService.findOne(id, token);
  }

  @Mutation(() => Reservation, {
    description:
      'Creates a pending reservation and its Stripe checkout (latest_payment.checkout_url)',
  })
  async createReservation(
    @Args('input') input: CreateReservationInput,
    @CurrentAuthToken() token?: string,
  ): Promise<Reservation> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.reservationsService.create(input, token);
  }

  @Mutation(() => Reservation)
  async updateReservationDates(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateReservationDatesInput,
    @CurrentAuthToken() token?: string,
  ): Promise<Reservation> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.reservationsService.updateDates(id, input, token);
  }

  @Mutation(() => Reservation)
  async cancelReservation(
    @Args('id', { type: () => ID }) id: string,
    @CurrentAuthToken() token?: string,
  ): Promise<Reservation> {
    if (!token) throw new UnauthorizedException('Authorization token is required');
    return this.reservationsService.cancel(id, token);
  }
}

