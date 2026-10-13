<?php

namespace Tests\Feature;

use App\Models\ApiClient;
use App\Models\User;
use App\Notifications\ExternalMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExternalNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_requests_without_a_valid_api_key_are_rejected(): void
    {
        $this->postJson('/api/v1/notifications', $this->messageData())->assertUnauthorized();
        $this->getJson('/api/v1/notifications?recipient=mesero-12', ['X-Api-Key' => 'ck_wrong'])
            ->assertUnauthorized();
    }

    public function test_client_can_send_a_notification_and_gets_a_confirmation(): void
    {
        [, $apiKey] = ApiClient::register('Restaurante');

        $response = $this->postJson('/api/v1/notifications', $this->messageData(), ['X-Api-Key' => $apiKey])
            ->assertCreated()
            ->assertJsonPath('recipient', 'mesero-12')
            ->assertJsonPath('type', 'order_ready')
            ->assertJsonPath('title', 'Orden lista')
            ->assertJsonPath('message', 'La orden 15 de la mesa 4 está lista.')
            ->assertJsonPath('data.orden', 15)
            ->assertJsonPath('delivered', true)
            ->assertJsonPath('read_at', null);

        $this->getJson("/api/v1/notifications/{$response->json('id')}", ['X-Api-Key' => $apiKey])
            ->assertOk()
            ->assertJsonPath('id', $response->json('id'));
    }

    public function test_client_can_list_and_mark_notifications_of_a_recipient(): void
    {
        [, $apiKey] = ApiClient::register('Restaurante');
        $headers = ['X-Api-Key' => $apiKey];

        $firstId = $this->postJson('/api/v1/notifications', $this->messageData(), $headers)->json('id');
        $this->postJson('/api/v1/notifications', $this->messageData(), $headers);
        $this->postJson('/api/v1/notifications', $this->messageData(['recipient' => 'cocina']), $headers);

        $this->getJson('/api/v1/notifications?recipient=mesero-12', $headers)
            ->assertOk()
            ->assertJsonPath('unread_count', 2)
            ->assertJsonCount(2, 'notifications');

        $this->patchJson("/api/v1/notifications/{$firstId}/read", [], $headers)
            ->assertOk()
            ->assertJsonPath('id', $firstId);

        $this->getJson('/api/v1/notifications?recipient=mesero-12&unread=1', $headers)
            ->assertJsonPath('unread_count', 1)
            ->assertJsonCount(1, 'notifications');

        $this->patchJson('/api/v1/notifications/read-all', ['recipient' => 'mesero-12'], $headers)
            ->assertOk()
            ->assertJsonPath('updated', 1);

        $this->getJson('/api/v1/notifications?recipient=cocina', $headers)
            ->assertJsonPath('unread_count', 1);
    }

    public function test_unknown_recipient_has_no_notifications(): void
    {
        [, $apiKey] = ApiClient::register('Restaurante');

        $this->getJson('/api/v1/notifications?recipient=nadie', ['X-Api-Key' => $apiKey])
            ->assertOk()
            ->assertJsonPath('unread_count', 0)
            ->assertJsonCount(0, 'notifications');
    }

    public function test_clients_are_isolated_from_each_other(): void
    {
        [, $restaurantKey] = ApiClient::register('Restaurante');
        [, $otherKey] = ApiClient::register('Cafetería');
        $id = $this->postJson('/api/v1/notifications', $this->messageData(), ['X-Api-Key' => $restaurantKey])->json('id');

        $this->getJson('/api/v1/notifications?recipient=mesero-12', ['X-Api-Key' => $otherKey])
            ->assertJsonCount(0, 'notifications');
        $this->getJson("/api/v1/notifications/{$id}", ['X-Api-Key' => $otherKey])->assertNotFound();
        $this->patchJson("/api/v1/notifications/{$id}/read", [], ['X-Api-Key' => $otherKey])->assertNotFound();
    }

    public function test_external_api_cannot_read_hotel_user_notifications(): void
    {
        [, $apiKey] = ApiClient::register('Restaurante');
        $user = User::factory()->create();
        $user->notify(new ExternalMessage('message', 'Hola', 'Interna'));
        $id = $user->notifications()->first()->id;

        $this->getJson("/api/v1/notifications/{$id}", ['X-Api-Key' => $apiKey])->assertNotFound();
    }

    public function test_validation_errors_are_reported(): void
    {
        [, $apiKey] = ApiClient::register('Restaurante');

        $this->postJson('/api/v1/notifications', ['type' => 'Con Espacios'], ['X-Api-Key' => $apiKey])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['recipient', 'title', 'message', 'type']);
    }

    private function messageData(array $overrides = []): array
    {
        return [
            'recipient' => 'mesero-12',
            'type' => 'order_ready',
            'title' => 'Orden lista',
            'message' => 'La orden 15 de la mesa 4 está lista.',
            'data' => ['orden' => 15, 'mesa' => 4],
            ...$overrides,
        ];
    }
}
