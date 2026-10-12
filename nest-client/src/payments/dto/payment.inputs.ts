import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreatePaymentInput {
  @Field(() => Int)
  reservation_id: number;

  @Field({
    nullable: true,
    description: 'card (Stripe Checkout, default) | cash (admin only)',
  })
  method?: string;
}
