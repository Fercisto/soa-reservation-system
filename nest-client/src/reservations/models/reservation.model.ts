import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Room } from '../../rooms/models/room.model.js';
import { User } from '../../auth/models/user.model.js';

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

  @Field({ defaultValue: 'confirmed' })
  status: string;

  @Field(() => Room, { nullable: true })
  room?: Room;

  @Field(() => User, { nullable: true })
  user?: User;
}

