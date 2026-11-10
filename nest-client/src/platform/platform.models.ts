import { Field, Float, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { JSONScalar } from '../common/json.scalar.js';

// Catalog shown on the home page

@ObjectType({ description: 'Subscription plan of the platform' })
export class PlanOffer {
  @Field() id: string;
  @Field() name: string;
  @Field(() => Float, { description: 'MXN per period' }) price: number;
  @Field(() => Int, { nullable: true, description: 'Max rooms; null is unlimited' })
  room_limit?: number;
  @Field(() => Int, { description: 'Credits included in each paid period' })
  monthly_credits: number;
  @Field(() => [String]) features: string[];
}

@ObjectType()
export class CreditPackage {
  @Field() id: string;
  @Field() name: string;
  @Field(() => Int) credits: number;
  @Field(() => Float) price: number;
}

@ObjectType({ description: 'Module charged in credits per use' })
export class CreditFeature {
  @Field() id: string;
  @Field() name: string;
  @Field(() => Int) cost: number;
  @Field() unit: string;
}

@ObjectType({ description: 'Module accessed with a time pass' })
export class PassOffer {
  @Field() id: string;
  @Field() name: string;
  @Field(() => JSONScalar, { description: '{ minutes, hours, days } credits per unit' })
  rates: Record<string, number>;
}

@ObjectType()
export class PlatformCatalog {
  @Field(() => Int) period_days: number;
  @Field(() => [PlanOffer]) plans: PlanOffer[];
  @Field(() => [CreditPackage]) credit_packages: CreditPackage[];
  @Field(() => [CreditFeature]) credit_features: CreditFeature[];
  @Field(() => [PassOffer]) passes: PassOffer[];
  @Field(() => Int, { description: 'Minutes are sold in blocks of this size' })
  minutes_block: number;
  @Field(() => JSONScalar) pass_limits: Record<string, { min: number; max: number }>;
}

// Hotels

@ObjectType({ description: 'Hotel a reservation or invoice belongs to' })
export class HotelRef {
  @Field(() => ID) id: number | string;
  @Field() name: string;
  @Field() slug: string;
}

@ObjectType({ description: 'Hotel as guests see it' })
export class PublicHotel {
  @Field(() => ID) id: number | string;
  @Field() name: string;
  @Field() slug: string;
  @Field({ nullable: true }) city?: string;
  @Field({ nullable: true }) description?: string;
  @Field(() => Int) rooms_count: number;
  @Field(() => Float, { nullable: true }) min_price?: number;
  @Field() has_restaurant: boolean;
}

@ObjectType({ description: "A hotel's account with the platform, for its admins" })
export class HotelAccount {
  @Field(() => ID) id: number | string;
  @Field() name: string;
  @Field() slug: string;
  @Field({ nullable: true }) city?: string;
  @Field({ nullable: true }) description?: string;
  @Field({ nullable: true, description: 'bronze | silver | gold' }) plan?: string;
  @Field({ nullable: true }) plan_name?: string;
  @Field() plan_active: boolean;
  @Field({ nullable: true }) plan_expires_at?: string;
  @Field(() => Int) credits: number;
  @Field(() => [String], { description: 'Modules of the active plan' }) features: string[];
  @Field(() => Int, { nullable: true }) room_limit?: number;
  @Field(() => Int, { nullable: true }) rooms_used?: number;
  @Field({ nullable: true }) restaurant_configured?: boolean;
  @Field(() => JSONScalar, {
    nullable: true,
    description: '{ feature: expires_at } of the running time passes',
  })
  active_passes?: Record<string, string>;
}

@InputType()
export class RegisterHotelInput {
  @Field() hotel_name: string;
  @Field() city: string;
  @Field({ nullable: true }) description?: string;
  @Field({ description: 'Name of the first admin' }) name: string;
  @Field() email: string;
  @Field() password: string;
  @Field() password_confirmation: string;
  @Field({ description: 'bronze | silver | gold' }) plan: string;
}

@InputType()
export class UpdateHotelInput {
  @Field() name: string;
  @Field() city: string;
  @Field({ nullable: true }) description?: string;
  @Field({
    nullable: true,
    description: "API key of the restaurant system (menu and staff). Omit to keep it, '' to remove it",
  })
  restaurant_api_key?: string;
}

// Billing

@ObjectType()
export class PersonName {
  @Field(() => ID) id: number | string;
  @Field() name: string;
}

@ObjectType({ description: 'Payment of a hotel to the platform' })
export class BillingPayment {
  @Field(() => ID) id: number | string;
  @Field({ description: 'subscription | credits' }) purpose: string;
  @Field(() => JSONScalar, { nullable: true }) metadata?: Record<string, unknown>;
  @Field(() => Float) amount: number;
  @Field() currency: string;
  @Field({ description: 'pending | paid | failed' }) status: string;
  @Field({ nullable: true }) description?: string;
  @Field({ nullable: true }) checkout_url?: string;
  @Field({ nullable: true }) paid_at?: string;
  @Field({ nullable: true }) created_at?: string;
  @Field(() => PersonName, { nullable: true }) user?: PersonName;
}

@ObjectType({ description: 'One movement of the credit ledger' })
export class CreditTransaction {
  @Field(() => ID) id: number | string;
  @Field({ description: 'purchase | bonus | usage' }) type: string;
  @Field({ nullable: true }) feature?: string;
  @Field(() => Int, { description: 'Positive adds credits, negative spends them' }) amount: number;
  @Field(() => Int) balance_after: number;
  @Field() description: string;
  @Field({ nullable: true }) reference?: string;
  @Field() created_at: string;
  @Field(() => PersonName, { nullable: true }) user?: PersonName;
}

@ObjectType()
export class FeaturePass {
  @Field(() => ID) id: number | string;
  @Field() feature: string;
  @Field({ description: 'minutes | hours | days' }) unit: string;
  @Field(() => Int) quantity: number;
  @Field(() => Int) credits: number;
  @Field() starts_at: string;
  @Field() expires_at: string;
  @Field(() => PersonName, { nullable: true }) user?: PersonName;
}

@InputType()
export class BuyPassInput {
  @Field({ description: 'analytics | campaigns' }) feature: string;
  @Field({ description: 'minutes | hours | days' }) unit: string;
  @Field(() => Int) quantity: number;
}

@ObjectType()
export class BuyPassPayload {
  @Field(() => FeaturePass) pass: FeaturePass;
  @Field(() => HotelAccount) hotel: HotelAccount;
  @Field(() => JSONScalar) active_passes: Record<string, string>;
}

@ObjectType()
export class RegisterHotelPayload {
  @Field({ nullable: true }) message?: string;
  @Field() token: string;
  @Field(() => JSONScalar, { description: 'The new admin with its hotel' }) user: Record<string, unknown>;
  @Field(() => BillingPayment, { nullable: true }) payment?: BillingPayment;
  @Field({ nullable: true }) payment_error?: string;
}

// Special modules

@ObjectType({ description: 'Occupancy and income report, paid with credits' })
export class Report {
  @Field(() => ID) id: number | string;
  @Field() from: string;
  @Field() to: string;
  @Field(() => Int) credits: number;
  @Field(() => JSONScalar) data: Record<string, unknown>;
  @Field() created_at: string;
  @Field(() => PersonName, { nullable: true }) user?: PersonName;
}

@ObjectType()
export class Campaign {
  @Field(() => ID) id: number | string;
  @Field({ description: 'past | upcoming | all' }) audience: string;
  @Field() title: string;
  @Field() message: string;
  @Field(() => Int) recipients: number;
  @Field() created_at: string;
  @Field(() => PersonName, { nullable: true }) user?: PersonName;
}

@ObjectType()
export class CampaignsOverview {
  @Field(() => JSONScalar, { description: '{ past, upcoming, all } number of guests' })
  audiences: Record<string, number>;
  @Field(() => [Campaign]) campaigns: Campaign[];
  @Field({ nullable: true }) pass_expires_at?: string;
}

@InputType()
export class CampaignInput {
  @Field({ description: 'past | upcoming | all' }) audience: string;
  @Field() title: string;
  @Field() message: string;
}
