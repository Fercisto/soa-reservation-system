<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_and_admins_are_notified_when_a_reservation_is_paid(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $customer = User::factory()->create(['name' => 'Ana']);

        $this->reserveAndPay($customer);

        $customerNotification = $customer->notifications()->first();
        $this->assertSame('reservation_confirmed', $customerNotification->type);
        $this->assertSame('Reservación confirmada', $customerNotification->data['title']);
        $this->assertStringContainsString('$200.00 con tarjeta', $customerNotification->data['message']);

        $adminNotification = $admin->notifications()->first();
        $this->assertSame('Nueva reservación', $adminNotification->data['title']);
        $this->assertStringStartsWith('Ana reservó', $adminNotification->data['message']);
    }

    public function test_cancelling_a_paid_reservation_notifies_the_customer_and_other_admins(): void
    {
        $actingAdmin = User::factory()->create(['role' => 'admin']);
        $otherAdmin = User::factory()->create(['role' => 'admin']);
        $customer = User::factory()->create();
        $reservationId = $this->reserveAndPay($customer);

        $this->actingAs($actingAdmin)
            ->patchJson("/api/reservations/{$reservationId}/cancel")
            ->assertOk();

        $customerNotification = $customer->notifications()->where('type', 'reservation_cancelled')->first();
        $this->assertStringContainsString('cancelada por el administrador', $customerNotification->data['message']);
        $this->assertStringContainsString('Se reembolsaron $200.00 a tu tarjeta', $customerNotification->data['message']);

        $this->assertSame(1, $otherAdmin->notifications()->where('type', 'reservation_cancelled')->count());
        $this->assertSame(0, $actingAdmin->notifications()->where('type', 'reservation_cancelled')->count());
    }

    public function test_abandoned_unpaid_reservation_does_not_notify_anyone(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $customer = User::factory()->create();
        $reservationId = $this->actingAs($customer)
            ->postJson('/api/reservations', $this->reservationData())
            ->json('id');

        $this->actingAs($customer)
            ->patchJson("/api/reservations/{$reservationId}/cancel")
            ->assertOk();

        $this->assertSame(0, $customer->notifications()->count());
        $this->assertSame(0, $admin->notifications()->count());
    }

    public function test_user_can_list_and_mark_notifications_as_read(): void
    {
        User::factory()->create(['role' => 'admin']);
        $customer = User::factory()->create();
        $this->reserveAndPay($customer);
        $this->reserveAndPay($customer, checkInDays: 10);

        $response = $this->actingAs($customer)
            ->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 2)
            ->assertJsonCount(2, 'notifications')
            ->assertJsonPath('notifications.0.title', 'Reservación confirmada');

        $this->actingAs($customer)
            ->patchJson('/api/notifications/'.$response->json('notifications.0.id').'/read')
            ->assertOk()
            ->assertJsonPath('id', $response->json('notifications.0.id'));

        $this->actingAs($customer)
            ->getJson('/api/notifications?unread=1')
            ->assertJsonPath('unread_count', 1)
            ->assertJsonCount(1, 'notifications');

        $this->actingAs($customer)
            ->patchJson('/api/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('updated', 1);

        $this->actingAs($customer)
            ->getJson('/api/notifications')
            ->assertJsonPath('unread_count', 0);
    }

    public function test_user_cannot_read_another_users_notification(): void
    {
        User::factory()->create(['role' => 'admin']);
        $customer = User::factory()->create();
        $this->reserveAndPay($customer);
        $notificationId = $customer->notifications()->first()->id;

        $this->actingAs(User::factory()->create())
            ->patchJson("/api/notifications/{$notificationId}/read")
            ->assertNotFound();
    }

    private function reserveAndPay(User $customer, int $checkInDays = 1): int
    {
        $reservation = $this->actingAs($customer)
            ->postJson('/api/reservations', $this->reservationData($checkInDays))
            ->assertCreated();

        $this->actingAs($customer)
            ->postJson("/api/payments/{$reservation->json('latest_payment.id')}/verify")
            ->assertOk()
            ->assertJsonPath('status', 'paid');

        return $reservation->json('id');
    }

    private function reservationData(int $checkInDays = 1): array
    {
        $room = Room::create([
            'number' => fake()->unique()->numerify('###'),
            'type' => 'double',
            'price' => 100,
            'capacity' => 2,
            'status' => 'available',
        ]);

        return [
            'room_id' => $room->id,
            'check_in' => now()->addDays($checkInDays)->toDateString(),
            'check_out' => now()->addDays($checkInDays + 2)->toDateString(),
        ];
    }
}
