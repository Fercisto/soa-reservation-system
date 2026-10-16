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

  @Field({ description: 'Payment provider, e.g. stripe' })
  provider: string;

  @Field({
    nullable: true,
    description: 'Checkout Session id in your own Stripe account (cs_...)',
  })
  stripe_session_id?: string;

  @Field({
    nullable: true,
    description:
      'PaymentIntent id in your own Stripe account (pi_...), once paid',
  })
  stripe_payment_intent_id?: string;

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

@ObjectType()
export class ExternalClientSettings {
  @Field()
  name: string;

  @Field({ nullable: true })
  callback_url?: string;

  @Field({ description: 'Whether your Stripe secret key is registered' })
  stripe_configured: boolean;

  @Field({ nullable: true, description: 'test | live' })
  stripe_mode?: string;

  @Field({
    nullable: true,
    description: 'Last 4 characters of your Stripe secret key',
  })
  stripe_key_last4?: string;
}

@InputType()
export class UpdateExternalClientSettingsInput {
  @Field({
    nullable: true,
    description:
      'Secret key of your own Stripe account (sk_test_... or sk_live_...)',
  })
  stripe_secret_key?: string;

  @Field({
    nullable: true,
    description: 'URL of your server that receives payment callbacks',
  })
  callback_url?: string;
}
