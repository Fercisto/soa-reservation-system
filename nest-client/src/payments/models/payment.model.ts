import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { Room } from '../../rooms/models/room.model.js';
import { User } from '../../auth/models/user.model.js';

@ObjectType()
export class PaymentReservation {
  @Field(() => ID)
  id: number | string;

  @Field(() => Int)
  room_id: number;

  @Field()
  check_in: string;

  @Field()
  check_out: string;

  @Field()
  status: string;

  @Field(() => Room, { nullable: true })
  room?: Room;
}

@ObjectType()
export class Payment {
  @Field(() => ID)
  id: number | string;

  @Field(() => Int)
  reservation_id: number;

  @Field(() => Int)
  user_id: number;

  @Field(() => Float)
  amount: number;

  @Field()
  currency: string;

  @Field({ description: 'card | cash' })
  method: string;

  @Field({ description: 'pending | paid | failed | refunded' })
  status: string;

  @Field({ description: 'stripe | manual | fake' })
  provider: string;

  @Field({ nullable: true })
  provider_reference?: string;

  @Field({
    nullable: true,
    description: 'Stripe Checkout URL where the customer completes the payment',
  })
  checkout_url?: string;

  @Field({ nullable: true })
  paid_at?: string;

  @Field({ nullable: true })
  created_at?: string;

  @Field(() => PaymentReservation, { nullable: true })
  reservation?: PaymentReservation;

  @Field(() => User, { nullable: true })
  user?: User;
}
