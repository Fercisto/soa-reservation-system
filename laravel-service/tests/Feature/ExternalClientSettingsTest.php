<?php

namespace Tests\Feature;

use App\Models\ApiClient;
use App\Models\Payment;
use App\Payments\StripeGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use ReflectionMethod;
use Stripe\StripeClient;
use Tests\TestCase;

class ExternalClientSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_sees_its_settings_without_secrets(): void
    {
        [, $apiKey] = ApiClient::register('Restaurante', 'https://restaurante.test/callbacks');

        $this->getJson('/api/v1/settings', ['X-Api-Key' => $apiKey])
            ->assertOk()
            ->assertExactJson([
                'name' => 'Restaurante',
                'callback_url' => 'https://restaurante.test/callbacks',
                'stripe_configured' => false,
                'stripe_mode' => null,
                'stripe_key_last4' => null,
            ]);
    }

    public function test_client_registers_its_own_stripe_key_encrypted(): void
    {
        [$client, $apiKey] = ApiClient::register('Restaurante');

        $this->putJson('/api/v1/settings', [
            'stripe_secret_key' => 'sk_test_restaurant1234',
            'callback_url' => 'https://restaurante.test/pagos',
        ], ['X-Api-Key' => $apiKey])
            ->assertOk()
            ->assertJsonPath('stripe_configured', true)
            ->assertJsonPath('stripe_mode', 'test')
            ->assertJsonPath('stripe_key_last4', '1234')
            ->assertJsonPath('callback_url', 'https://restaurante.test/pagos')
            ->assertJsonMissingPath('stripe_secret_key');

        $stored = DB::table('api_clients')->where('id', $client->id)->value('stripe_secret');
        $this->assertNotSame('sk_test_restaurant1234', $stored);
        $this->assertSame('sk_test_restaurant1234', $client->fresh()->stripe_secret);
    }

    public function test_invalid_stripe_key_format_is_rejected(): void
    {
        [, $apiKey] = ApiClient::register('Restaurante');

        $this->putJson('/api/v1/settings', ['stripe_secret_key' => 'pk_test_publishable'], ['X-Api-Key' => $apiKey])
            ->assertStatus(422)
            ->assertJsonValidationErrors('stripe_secret_key');
    }

    public function test_payment_is_rejected_until_the_client_registers_its_stripe_account(): void
    {
        config(['services.payments.driver' => 'stripe']);
        [, $apiKey] = ApiClient::register('Restaurante');

        $this->postJson('/api/v1/payments', [
            'reference' => 'ORDEN-1',
            'description' => 'Mesa 5',
            'amount' => 350,
            'success_url' => 'https://restaurante.test/ok',
            'cancel_url' => 'https://restaurante.test/cancelado',
        ], ['X-Api-Key' => $apiKey])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Register your Stripe secret key first (PUT /v1/settings).');

        $this->assertSame(0, Payment::count());
    }

    public function test_stripe_gateway_uses_the_key_of_the_client_for_its_payments(): void
    {
        [$client] = ApiClient::register('Restaurante');
        $client->update(['stripe_secret' => 'sk_test_restaurant']);
        $external = $client->payments()->create(['amount' => 100, 'currency' => 'mxn', 'method' => 'card', 'status' => 'pending', 'provider' => 'stripe']);
        $hotel = Payment::create(['amount' => 100, 'currency' => 'mxn', 'method' => 'card', 'status' => 'pending', 'provider' => 'stripe']);

        $gateway = new StripeGateway(new \Stripe\StripeClient(['api_key' => 'sk_test_hotel']), null);
        $stripeFor = new ReflectionMethod($gateway, 'stripeFor');

        $this->assertSame('sk_test_restaurant', $stripeFor->invoke($gateway, $external)->getApiKey());
        $this->assertSame('sk_test_hotel', $stripeFor->invoke($gateway, $hotel)->getApiKey());
    }
}
