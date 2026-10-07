import { Field, ObjectType } from '@nestjs/graphql';
import { User } from './user.model.js';

@ObjectType()
export class AuthPayload {
  @Field({ nullable: true })
  message?: string;

  @Field()
  token: string;

  @Field(() => User)
  user: User;
}

