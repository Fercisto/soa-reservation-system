import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard.js';
import { CurrentAuthToken } from '../auth/auth.decorator.js';
import { LaravelClient } from '../common/laravel.client.js';
import { JSONScalar } from '../common/json.scalar.js';
import {
  BillingPayment,
  BuyPassInput,
  BuyPassPayload,
  Campaign,
  CampaignInput,
  CampaignsOverview,
  CreditTransaction,
  FeaturePass,
  HotelAccount,
  PlatformCatalog,
  PublicHotel,
  RegisterHotelInput,
  RegisterHotelPayload,
  Report,
  UpdateHotelInput,
} from './platform.models.js';

/**
 * SaaS platform: catalog, hotel sign-up, each hotel's account (plan, credits,
 * time passes) and the special modules. Laravel enforces plans, credits and passes.
 */
@Resolver()
export class PlatformResolver {
  constructor(private readonly laravel: LaravelClient) {}

  // Public

  @Query(() => PlatformCatalog, { description: 'Plans, credit packages and special modules' })
  platformCatalog(): Promise<PlatformCatalog> {
    return this.laravel.request('get', '/plans');
  }

  @Query(() => [PublicHotel], { description: 'Hotels with an active subscription' })
  hotels(): Promise<PublicHotel[]> {
    return this.laravel.request('get', '/hotels');
  }

  @Query(() => PublicHotel)
  hotel(@Args('slug') slug: string): Promise<PublicHotel> {
    return this.laravel.request('get', `/hotels/${encodeURIComponent(slug)}`);
  }

  @Mutation(() => RegisterHotelPayload, {
    description: 'Creates a hotel and its admin and starts the Stripe checkout of the plan',
  })
  registerHotel(@Args('input') input: RegisterHotelInput): Promise<RegisterHotelPayload> {
    return this.laravel.request('post', '/hotels', { body: input });
  }

  // The admin's hotel and its account

  @UseGuards(AuthGuard)
  @Query(() => HotelAccount)
  myHotel(@CurrentAuthToken() token: string): Promise<HotelAccount> {
    return this.laravel.request('get', '/hotel', { token });
  }

  @UseGuards(AuthGuard)
  @Mutation(() => HotelAccount)
  updateMyHotel(
    @Args('input') input: UpdateHotelInput,
    @CurrentAuthToken() token: string,
  ): Promise<HotelAccount> {
    return this.laravel.request('put', '/hotel', { token, body: input });
  }

  @UseGuards(AuthGuard)
  @Query(() => [BillingPayment], { description: 'Subscription and credit payments' })
  billingPayments(@CurrentAuthToken() token: string): Promise<BillingPayment[]> {
    return this.laravel.request('get', '/billing/payments', { token });
  }

  @UseGuards(AuthGuard)
  @Mutation(() => BillingPayment, { description: 'Returns the Stripe checkout_url of the plan' })
  subscribe(
    @Args('plan') plan: string,
    @CurrentAuthToken() token: string,
  ): Promise<BillingPayment> {
    return this.laravel.request('post', '/billing/subscription', { token, body: { plan } });
  }

  @UseGuards(AuthGuard)
  @Mutation(() => BillingPayment, { description: 'Returns the Stripe checkout_url of the package' })
  buyCredits(
    @Args('package') pkg: string,
    @CurrentAuthToken() token: string,
  ): Promise<BillingPayment> {
    return this.laravel.request('post', '/billing/credits', { token, body: { package: pkg } });
  }

  @UseGuards(AuthGuard)
  @Mutation(() => BillingPayment, {
    description: 'Checks the payment with Stripe and activates the plan or adds the credits',
  })
  verifyBillingPayment(
    @Args('id', { type: () => ID }) id: string,
    @CurrentAuthToken() token: string,
  ): Promise<BillingPayment> {
    return this.laravel.request('post', `/billing/payments/${id}/verify`, { token });
  }

  @UseGuards(AuthGuard)
  @Query(() => [CreditTransaction], { description: 'Credit ledger, newest first' })
  creditTransactions(@CurrentAuthToken() token: string): Promise<CreditTransaction[]> {
    return this.laravel.request('get', '/billing/transactions', { token });
  }

  @UseGuards(AuthGuard)
  @Query(() => [FeaturePass])
  featurePasses(@CurrentAuthToken() token: string): Promise<FeaturePass[]> {
    return this.laravel.request('get', '/billing/passes', { token });
  }

  @UseGuards(AuthGuard)
  @Mutation(() => BuyPassPayload, { description: 'Spends credits on a time pass' })
  buyPass(
    @Args('input') input: BuyPassInput,
    @CurrentAuthToken() token: string,
  ): Promise<BuyPassPayload> {
    return this.laravel.request('post', '/billing/passes', { token, body: input });
  }

  // Modules charged in credits

  @UseGuards(AuthGuard)
  @Query(() => [Report])
  reports(@CurrentAuthToken() token: string): Promise<Report[]> {
    return this.laravel.request('get', '/reports', { token });
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Report, { description: 'Spends credits on an occupancy and income report' })
  generateReport(
    @Args('from') from: string,
    @Args('to') to: string,
    @CurrentAuthToken() token: string,
  ): Promise<Report> {
    return this.laravel.request('post', '/reports', { token, body: { from, to } });
  }

  @UseGuards(AuthGuard)
  @Query(() => String, { description: 'PDF of a generated report, base64 encoded' })
  async reportPdf(
    @Args('id', { type: () => ID }) id: string,
    @CurrentAuthToken() token: string,
  ): Promise<string> {
    const pdf = await this.laravel.request<ArrayBuffer>('get', `/reports/${id}/pdf`, {
      token,
      binary: true,
    });

    return Buffer.from(pdf).toString('base64');
  }

  // Modules accessed with a time pass

  @UseGuards(AuthGuard)
  @Query(() => JSONScalar, {
    description: 'Monthly income, occupancy by room and guest behavior',
  })
  analytics(@CurrentAuthToken() token: string): Promise<Record<string, unknown>> {
    return this.laravel.request('get', '/analytics', { token });
  }

  @UseGuards(AuthGuard)
  @Query(() => CampaignsOverview)
  campaigns(@CurrentAuthToken() token: string): Promise<CampaignsOverview> {
    return this.laravel.request('get', '/campaigns', { token });
  }

  @UseGuards(AuthGuard)
  @Mutation(() => Campaign, { description: "Sends an in-app message to the hotel's guests" })
  sendCampaign(
    @Args('input') input: CampaignInput,
    @CurrentAuthToken() token: string,
  ): Promise<Campaign> {
    return this.laravel.request('post', '/campaigns', { token, body: input });
  }
}
