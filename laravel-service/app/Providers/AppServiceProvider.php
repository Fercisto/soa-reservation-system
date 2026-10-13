<?php

namespace App\Providers;

use App\Payments\FakeGateway;
use App\Payments\PaymentGateway;
use App\Payments\StripeGateway;
use Illuminate\Support\ServiceProvider;
use Stripe\StripeClient;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(PaymentGateway::class, function () {
            return match (config('services.payments.driver')) {
                'fake' => new FakeGateway(),
                default => new StripeGateway(
                    new StripeClient(['api_key' => config('services.stripe.secret') ?: null]),
                    config('services.stripe.webhook_secret'),
                ),
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
