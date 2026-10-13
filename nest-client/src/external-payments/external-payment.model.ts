import { Field, Float, ID, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ExternalPayment {
  @Field(() => ID)
  id: number | string;

  @Field({ description: "The client's own identifier, e.g. its order number" })
  reference: string;

  @Field()
  description: string;

  @Field(() => Float)
  amount: number;

  @Field()
  currency: string;

  @Field({ description: 'pending | paid | failed | refunded' })
  status: string;

  @Field({ nullable: true })
  customer_email?: string;

  @Field({
    nullable: true,
    description: 'Stripe Checkout page for the customer; only while pending',
  })
  checkout_url?: string;

  @Field({ nullable: true })
  paid_at?: string;

  @Field()
  created_at: string;

  @Field()
  updated_at: string;
}

@InputType()
export class CreateExternalPaymentInput {
  @Field({ description: "The client's own identifier, e.g. its order number" })
  reference: string;

  @Field({ description: 'Shown to the customer on the checkout page' })
  description: string;

  @Field(() => Float, { description: 'Minimum 10.00 MXN' })
  amount: number;

  @Field({ nullable: true, description: 'mxn (default) | usd' })
  currency?: string;

  @Field({ nullable: true })
  customer_email?: string;

  @Field({ description: 'Where Stripe sends the customer after paying' })
  success_url: string;

  @Field({ description: 'Where Stripe sends the customer if they cancel' })
  cancel_url: string;
}
