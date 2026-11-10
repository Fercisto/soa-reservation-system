import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { HotelAccount } from '../../platform/platform.models.js';

@ObjectType()
export class User {
  @Field(() => ID)
  id: number | string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field({ nullable: true, description: 'admin (of a hotel) | customer (guest)' })
  role?: string;

  @Field(() => Int, { nullable: true })
  hotel_id?: number;

  @Field(() => HotelAccount, {
    nullable: true,
    description: 'The hotel an admin manages, with its plan, credits and modules',
  })
  hotel?: HotelAccount;
}

