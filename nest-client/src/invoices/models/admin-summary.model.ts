import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { Reservation } from '../../reservations/models/reservation.model.js';

@ObjectType({ description: 'Key figures for the admin dashboard' })
export class AdminSummary {
  @Field({ description: 'Today in the hotel time zone (YYYY-MM-DD)' })
  today: string;

  @Field({ description: 'Current month (YYYY-MM)' })
  month: string;

  @Field(() => Float, { description: 'Paid this month, refunds excluded' })
  revenue_month: number;

  @Field(() => Int)
  payments_month: number;

  @Field(() => Float, { description: 'Refunded this month' })
  refunds_month: number;

  @Field(() => Float, { description: 'Total of the invoices issued this month' })
  invoiced_month: number;

  @Field(() => Int)
  invoices_month: number;

  @Field(() => Float, { description: 'Paid reservations not invoiced yet' })
  uninvoiced_amount: number;

  @Field(() => Int)
  uninvoiced_count: number;

  @Field(() => Int, { description: 'Rooms with a guest tonight' })
  occupied_rooms: number;

  @Field(() => Int, { description: 'Rooms not inactive' })
  rooms: number;

  @Field(() => Float, { description: 'occupied_rooms / rooms, in percent' })
  occupancy_rate: number;

  @Field(() => Int)
  arrivals_today: number;

  @Field(() => Int)
  departures_today: number;

  @Field(() => Int, { description: 'Confirmed reservations not finished yet' })
  active_reservations: number;

  @Field(() => Int, { description: 'Reservations waiting for their payment' })
  pending_payments: number;

  @Field(() => [Reservation], { description: 'Confirmed check-ins in the next 7 days' })
  upcoming_arrivals: Reservation[];
}
