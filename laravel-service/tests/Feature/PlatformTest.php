<?php

namespace Tests\Feature;

use App\Console\Commands\ConsumeMessages;
use App\Messaging\MessageHandler;
use App\Messaging\NotificationBus;
use App\Models\ServiceLog;
use App\Models\User;
use App\Notifications\GuestCampaign;
use App\Models\Campaign;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use InvalidArgumentException;
use Tests\TestCase;

class PlatformTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_the_superadmin_sees_the_platform(): void
    {
        $this->actingAs($this->admin())->getJson('/api/platform/logs')->assertForbidden();
        $this->actingAs(User::factory()->create())->getJson('/api/platform/health')->assertForbidden();

        $this->actingAs($this->superadmin())
            ->getJson('/api/platform/hotels')
            ->assertOk();
    }

    public function test_service_log_messages_are_stored_and_listed(): void
    {
        $hotel = $this->hotel();
        $handler = app(MessageHandler::class);

        $handler->handle('service_logs', [
            'service' => 'Reservaciones',
            'operation' => 'createReservation',
            'kind' => 'mutation',
            'actor' => 'guest@test.mx',
            'role' => 'customer',
            'hotel_id' => $hotel->id,
            'success' => true,
            'duration_ms' => 320,
            'occurred_at' => now()->subMinute()->toISOString(),
        ]);
        $handler->handle('service_logs', [
            'service' => 'Facturación',
            'operation' => 'requestInvoice',
            'kind' => 'mutation',
            'success' => false,
            'status_code' => 502,
            'error' => 'CFDI40143 - Este RFC del receptor no existe.',
            'duration_ms' => 1500,
        ]);

        $superadmin = $this->superadmin();

        $this->actingAs($superadmin)
            ->getJson('/api/platform/logs?result=error')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.operation', 'requestInvoice');

        $this->actingAs($superadmin)
            ->getJson('/api/platform/logs?search=guest@test')
            ->assertJsonPath('data.0.hotel.slug', $hotel->slug);

        $this->actingAs($superadmin)
            ->getJson('/api/platform/logs/summary')
            ->assertJsonPath('calls', 2)
            ->assertJsonPath('errors', 1)
            ->assertJsonPath('average_ms', 910)
            ->assertJsonCount(24, 'hours');
    }

    public function test_invalid_messages_are_rejected(): void
    {
        $this->expectException(InvalidArgumentException::class);

        app(MessageHandler::class)->handle('service_logs', ['operation' => 'x']);
    }

    public function test_queued_notification_is_delivered_by_the_consumer(): void
    {
        $hotel = $this->hotel();
        $guests = User::factory()->count(2)->create();
        $campaign = Campaign::forceCreate([
            'hotel_id' => $hotel->id,
            'audience' => 'all',
            'title' => 'Promo',
            'message' => 'Hola',
            'recipients' => 2,
        ]);

        // The message NotificationBus publishes when RabbitMQ is enabled.
        app(MessageHandler::class)->handle('notifications', [
            'notification' => base64_encode(serialize(new GuestCampaign($hotel, $campaign))),
            'notifiable_type' => User::class,
            'notifiable_ids' => $guests->modelKeys(),
        ]);

        foreach ($guests as $guest) {
            $this->assertSame("{$hotel->name}: Promo", $guest->notifications()->first()->data['title']);
        }

        $log = ServiceLog::firstWhere('service', 'Notificaciones');
        $this->assertSame('GuestCampaign', $log->operation);
        $this->assertSame('worker', $log->source);
        $this->assertSame($hotel->id, $log->hotel_id);
    }

    public function test_notifications_are_stored_right_away_when_the_broker_is_unreachable(): void
    {
        config(['services.rabbitmq.enabled' => true, 'services.rabbitmq.port' => 1]);
        $hotel = $this->hotel();
        $guest = User::factory()->create();
        $campaign = Campaign::forceCreate([
            'hotel_id' => $hotel->id, 'audience' => 'all', 'title' => 'Promo', 'message' => 'Hola', 'recipients' => 1,
        ]);

        NotificationBus::send($guest, new GuestCampaign($hotel, $campaign));

        $this->assertSame(1, $guest->notifications()->count());
    }

    public function test_health_reports_the_consumer_heartbeat(): void
    {
        config(['services.rabbitmq.enabled' => false]);

        $this->actingAs($this->superadmin())
            ->getJson('/api/platform/health')
            ->assertOk()
            ->assertJsonPath('services.0.id', 'database')
            ->assertJsonPath('services.0.status', 'up')
            ->assertJsonPath('services.4.id', 'worker')
            ->assertJsonPath('services.4.status', 'disabled');

        config(['services.rabbitmq.enabled' => true, 'services.rabbitmq.port' => 1]);
        Cache::put(ConsumeMessages::HEARTBEAT_KEY, now()->subSeconds(5)->toISOString());

        $this->actingAs($this->superadmin())
            ->getJson('/api/platform/health')
            ->assertJsonPath('services.3.status', 'down')
            ->assertJsonPath('services.4.status', 'up');
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => 'superadmin']);
    }
}
