import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';

import { JSONScalar } from '../common/json.scalar.js';

@ObjectType()
export class ExternalNotification {
  @Field(() => ID)
  id: string;

  @Field({ description: "The client's own id of the recipient, e.g. mesero-12" })
  recipient: string;

  @Field({ description: 'Free category chosen by the sender, e.g. order_ready' })
  type: string;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field(() => JSONScalar, { nullable: true })
  data?: Record<string, unknown>;

  @Field({ description: 'Confirms the notification was stored and is available to the recipient' })
  delivered: boolean;

  @Field({ nullable: true, description: 'Null while unread' })
  read_at?: string;

  @Field()
  created_at: string;
}

@ObjectType()
export class ExternalNotificationList {
  @Field(() => Int)
  unread_count: number;

  @Field(() => [ExternalNotification])
  notifications: ExternalNotification[];
}

@InputType()
export class SendExternalNotificationInput {
  @Field({ description: "The client's own id of the recipient, e.g. mesero-12" })
  recipient: string;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field({
    nullable: true,
    description: 'Lowercase category, e.g. order_ready (default: message)',
  })
  type?: string;

  @Field(() => JSONScalar, { nullable: true, description: 'Any extra data, e.g. { "orden": 15 }' })
  data?: Record<string, unknown>;
}
