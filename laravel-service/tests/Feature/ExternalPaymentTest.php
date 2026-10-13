<?php

namespace Tests\Feature;

use App\Models\ApiClient;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ExternalPaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_requests_without_a_valid_api_key_are_rejected(): void
    {
        $this->postJson('/api/v1/payments', $this->paymentData())->assertUnauthorized();

        $this->postJson('/api/v1/payments', $this->paymentData(), ['X-Api-Key' => 'ck_wrong'])
            ->assertUnauthorized();
    }

    public function test_client_can_create_and_verify_a_payment(): void
    {
        [, $apiKey] = ApiClient::register('Restaurante');

        $created = $this->postJson('/api/v1/payments', $this->paymentData(), ['X-Api-Key' => $apiKey])
            ->assertCreated()
            ->assertJsonPath('reference', 'ORDEN-1')
            ->assertJsonPath('description', 'Mesa 5: 2 tacos, 1 agua')
            ->assertJsonPath('amount', 350)
            ->assertJsonPath('currency', 'mxn')
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('checkout_url', 'https://restaurante.test/ok');

        $this->assertNull(Payment::find($created->json('id'))->reservation_id);

        $this->postJson("/api/v1/payments/{$created->json('id')}/verify", [], ['X-Api-Key' => $apiKey])
            ->assertOk()
            ->assertJsonPath('status', 'paid')
            ->assertJsonPath('checkout_url', null);
    }

    public function test_creating_the_same_reference_twice_returns_the_open_payment(): void
    {
        [, $apiKey] = ApiClient::register('Restaurante');

        $firstId = $this->postJson('/api/v1/payments', $this->paymentData(), ['X-Api-Key' => $apiKey])->json('id');

        $this->postJson('/api/v1/payments', $this->paymentData(), ['X-Api-Key' => $apiKey])
            ->assertOk()
            ->assertJsonPath('id', $firstId);
    }

    public function test_client_cannot_see_payments_of_another_client(): void
    {
        [, $restaurantKey] = ApiClient::register('Restaurante');
        [, $otherKey] = ApiClient::register('Cafetería');
        $paymentId = $this->postJson('/api/v1/payments', $this->paymentData(), ['X-Api-Key' => $restaurantKey])->json('id');

        $this->getJson("/api/v1/payments/{$paymentId}", ['X-Api-Key' => $otherKey])->assertNotFound();
        $this->getJson('/api/v1/payments', ['X-Api-Key' => $otherKey])->assertOk()->assertJsonCount(0);
        $this->getJson('/api/v1/payments?reference=ORDEN-1', ['X-Api-Key' => $restaurantKey])->assertJsonCount(1);
    }

    public function test_client_can_cancel_a_pending_payment_and_refund_a_paid_one(): void
    {
        [, $apiKey] = ApiClient::register('Restaurante');
        $headers = ['X-Api-Key' => $apiKey];

        $pendingId = $this->postJson('/api/v1/payments', $this->paymentData('ORDEN-1'), $headers)->json('id');
        $this->postJson("/api/v1/payments/{$pendingId}/cancel", [], $headers)
            ->assertOk()
            ->assertJsonPath('status', 'failed');

        $paidId = $this->postJson('/api/v1/payments', $this->paymentData('ORDEN-2'), $headers)->json('id');
        $this->postJson("/api/v1/payments/{$paidId}/refund", [], $headers)->assertStatus(422);
        $this->postJson("/api/v1/payments/{$paidId}/verify", [], $headers);
        $this->postJson("/api/v1/payments/{$paidId}/refund", [], $headers)
            ->assertOk()
            ->assertJsonPath('status', 'refunded');
    }

    public function test_status_changes_are_sent_to_the_client_callback_signed(): void
    {
        Http::fake();
        [$client, $apiKey] = ApiClient::register('Restaurante', 'https://restaurante.test/callbacks/pagos');
        $headers = ['X-Api-Key' => $apiKey];

        $paymentId = $this->postJson('/api/v1/payments', $this->paymentData(), $headers)->json('id');
        Http::assertNothingSent();

        $this->postJson("/api/v1/payments/{$paymentId}/verify", [], $headers);

        Http::assertSent(function (Request $request) use ($client) {
            return $request->url() === 'https://restaurante.test/callbacks/pagos'
                && $request['event'] === 'payment.paid'
                && $request['data']['reference'] === 'ORDEN-1'
                && $request->header('X-Signature')[0] === hash_hmac('sha256', $request->body(), $client->callback_secret);
        });
    }

    public function test_validation_errors_are_reported(): void
    {
        [, $apiKey] = ApiClient::register('Restaurante');

        $this->postJson('/api/v1/payments', ['reference' => 'X', 'amount' => 5], ['X-Api-Key' => $apiKey])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['description', 'amount', 'success_url', 'cancel_url']);
    }

    public function test_external_payments_are_not_listed_in_the_hotel_payments(): void
    {
        [, $apiKey] = ApiClient::register('Restaurante');
        $this->postJson('/api/v1/payments', $this->paymentData(), ['X-Api-Key' => $apiKey]);

        $this->actingAs(User::factory()->create(['role' => 'admin']))
            ->getJson('/api/payments')
            ->assertOk()
            ->assertJsonCount(0);
    }

    private function paymentData(string $reference = 'ORDEN-1'): array
    {
        return [
            'reference' => $reference,
            'description' => 'Mesa 5: 2 tacos, 1 agua',
            'amount' => 350,
            'customer_email' => 'cliente@correo.com',
            'success_url' => 'https://restaurante.test/ok',
            'cancel_url' => 'https://restaurante.test/cancelado',
        ];
    }
}
