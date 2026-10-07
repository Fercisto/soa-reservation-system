import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Room {
  @Field(() => ID)
  id: number | string;

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

  @Field({ defaultValue: 'available' })
  status: string;
}

