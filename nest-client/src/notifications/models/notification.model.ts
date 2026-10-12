import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('Notification')
export class AppNotification {
  @Field(() => ID)
  id: string;

  @Field({ description: 'reservation_confirmed | reservation_cancelled' })
  type: string;

  @Field()
  title: string;

  @Field()
  message: string;

  @Field(() => Int, { nullable: true })
  reservation_id?: number;

  @Field({ nullable: true, description: 'Null while the notification is unread' })
  read_at?: string;

  @Field()
  created_at: string;
}

@ObjectType()
export class NotificationList {
  @Field(() => Int)
  unread_count: number;

  @Field(() => [AppNotification])
  notifications: AppNotification[];
}
