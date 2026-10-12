import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Room } from '../../rooms/models/room.model.js';
import { User } from '../../auth/models/user.model.js';
import { Payment } from '../../payments/models/payment.model.js';

@ObjectType()
export class Reservation {
  @Field(() => ID)
  id: number | string;

  @Field(() => Int)
  room_id: number;

  @Field(() => Int)
  user_id: number;

  @Field()
  check_in: string;

  @Field()
  check_out: string;

  @Field({ description: 'pending | confirmed | cancelled | expired' })
  status: string;

  @Field({
    nullable: true,
    description: 'End of the payment window of a pending reservation',
  })
  expires_at?: string;

  @Field(() => Room, { nullable: true })
  room?: Room;

  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => Payment, { nullable: true })
  latest_payment?: Payment;
}

