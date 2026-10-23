<?php

namespace App\Providers;

use App\Invoicing\CfdiBuilder;
use App\Invoicing\FakeInvoiceGateway;
use App\Invoicing\InvoiceGateway;
use App\Invoicing\ProfactGateway;
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

        $this->app->bind(InvoiceGateway::class, function () {
            return match (config('services.invoicing.driver')) {
                'fake' => new FakeInvoiceGateway(),
                default => new ProfactGateway(
                    config('services.profact.wsdl'),
                    (string) config('services.profact.user'),
                    config('services.invoicing.emitter.rfc'),
                    (bool) config('services.profact.verify_ssl'),
                ),
            };
        });

        $this->app->bind(CfdiBuilder::class, fn () => new CfdiBuilder(config('services.invoicing.emitter')));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
