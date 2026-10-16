<?php

use App\Models\ApiClient;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('api-client:create {name}
    {--callback-url= : URL that receives payment status changes}
    {--stripe-secret= : Secret key of the Stripe account of the client (the client can also set it with PUT /v1/settings)}', function (string $name) {
    [$client, $apiKey] = ApiClient::register($name, $this->option('callback-url'));

    if ($this->option('stripe-secret')) {
        $client->update(['stripe_secret' => $this->option('stripe-secret')]);
    }

    $this->info("API client \"{$client->name}\" created (id {$client->id}).");
    $this->line("API key:         {$apiKey}");
    $this->line("Callback secret: {$client->callback_secret}");
    $this->line('Stripe account:  '.($client->hasStripeAccount() ? 'configured' : 'not configured (the client must register its key with PUT /v1/settings)'));
    $this->warn('Save the API key now: it is stored hashed and cannot be shown again.');
})->purpose('Register an external system that can use the payments API');
