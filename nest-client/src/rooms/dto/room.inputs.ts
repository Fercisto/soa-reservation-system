import { Field, Float, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateRoomInput {
  @Field()
  number: string;

  @Field()
  type: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  price: number;

  @Field(() => Int)
  capacity: number;

  @Field(() => [String], { nullable: true })
  features?: string[];

  @Field({ nullable: true })
  status?: string;
}

@InputType()
export class UpdateRoomInput {
  @Field({ nullable: true })
  number?: string;

  @Field({ nullable: true })
  type?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float, { nullable: true })
  price?: number;

  @Field(() => Int, { nullable: true })
  capacity?: number;

  @Field(() => [String], { nullable: true })
  features?: string[];

  @Field({ nullable: true })
  status?: string;
}

