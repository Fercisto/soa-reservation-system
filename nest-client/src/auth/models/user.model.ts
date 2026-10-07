import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field(() => ID)
  id: number | string;

  @Field()
  name: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  role?: string;
}

