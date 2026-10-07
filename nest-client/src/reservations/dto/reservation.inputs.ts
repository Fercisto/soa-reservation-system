import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateReservationInput {
  @Field(() => Int)
  room_id: number;

  @Field()
  check_in: string;

  @Field()
  check_out: string;
}

@InputType()
export class UpdateReservationDatesInput {
  @Field()
  check_in: string;

  @Field()
  check_out: string;
}

