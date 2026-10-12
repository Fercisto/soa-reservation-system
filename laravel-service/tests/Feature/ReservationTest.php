<?php

namespace Tests\Feature;

use App\Models\Reservation;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReservationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_manage_a_reservation_lifecycle(): void
    {
        $user = User::factory()->create();
        $room = $this->availableRoom();

        $createResponse = $this->actingAs($user)->postJson('/api/reservations', [
            'room_id' => $room->id,
            'check_in' => '2026-11-10',
            'check_out' => '2026-11-15',
        ]);

        $createResponse
            ->assertCreated()
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('room.id', $room->id)
            ->assertJsonPath('latest_payment.status', 'pending')
            ->assertJsonPath('latest_payment.amount', '627.50');

        $this->assertNotNull($createResponse->json('latest_payment.checkout_url'));
        $this->assertNotNull($createResponse->json('expires_at'));

        $reservationId = $createResponse->json('id');

        $this->actingAs($user)
            ->getJson("/api/reservations/{$reservationId}")
            ->assertOk()
            ->assertJsonPath('check_in', '2026-11-10');

        $this->actingAs($user)
            ->patchJson("/api/reservations/{$reservationId}/cancel")
            ->assertOk()
            ->assertJsonPath('status', 'cancelled')
            ->assertJsonPath('latest_payment.status', 'failed');

        $this->actingAs($user)
            ->getJson('/api/reservations')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.status', 'cancelled');
    }

    public function test_admin_can_view_all_reservations(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $customer = User::factory()->create(['role' => 'customer']);
        $room = $this->availableRoom();

        $this->actingAs($customer)->postJson('/api/reservations', [
            'room_id' => $room->id,
            'check_in' => '2026-11-10',
            'check_out' => '2026-11-12',
        ])->assertCreated();

        $this->actingAs($admin)
            ->getJson('/api/reservations')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.user.email', $customer->email)
            ->assertJsonPath('0.room.id', $room->id);
    }

    public function test_user_cannot_reserve_overlapping_dates(): void
    {
        $user = User::factory()->create();
        $room = $this->availableRoom();

        $this->actingAs($user)->postJson('/api/reservations', [
            'room_id' => $room->id,
            'check_in' => '2026-12-01',
            'check_out' => '2026-12-05',
        ])->assertCreated();

        $this->actingAs($user)
            ->postJson('/api/reservations', [
                'room_id' => $room->id,
                'check_in' => '2026-12-04',
                'check_out' => '2026-12-08',
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Room is already reserved for the selected dates.');
    }

    public function test_user_cannot_create_reservation_in_the_past(): void
    {
        $user = User::factory()->create();
        $room = $this->availableRoom();
        $yesterday = now()->subDay()->toDateString();
        $today = now()->toDateString();

        $this->actingAs($user)
            ->postJson('/api/reservations', [
                'room_id' => $room->id,
                'check_in' => $yesterday,
                'check_out' => $today,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('check_in');
    }

    public function test_user_cannot_move_reservation_dates_into_the_past(): void
    {
        $user = User::factory()->create();
        $room = $this->availableRoom();
        $reservation = $user->reservations()->create([
            'room_id' => $room->id,
            'check_in' => now()->addDay()->toDateString(),
            'check_out' => now()->addDays(3)->toDateString(),
            'status' => 'confirmed',
        ]);

        $this->actingAs($user)
            ->patchJson("/api/reservations/{$reservation->id}/dates", [
                'check_in' => now()->subDay()->toDateString(),
                'check_out' => now()->addDay()->toDateString(),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('check_in');
    }

    public function test_admin_can_view_and_cancel_any_reservation(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $reservation = $this->reservationFor(User::factory()->create(['role' => 'customer']));

        $this->actingAs($admin)
            ->getJson("/api/reservations/{$reservation->id}")
            ->assertOk()
            ->assertJsonPath('id', $reservation->id);

        $this->actingAs($admin)
            ->patchJson("/api/reservations/{$reservation->id}/cancel")
            ->assertOk()
            ->assertJsonPath('status', 'cancelled');
    }

    public function test_customer_cannot_access_another_customers_reservation(): void
    {
        $reservation = $this->reservationFor(User::factory()->create());

        $this->actingAs(User::factory()->create())
            ->getJson("/api/reservations/{$reservation->id}")
            ->assertNotFound();
    }

    public function test_user_cannot_move_reservation_when_room_is_not_available(): void
    {
        $user = User::factory()->create();
        $reservation = $this->reservationFor($user);
        $reservation->room->update(['status' => 'maintenance']);

        $this->actingAs($user)
            ->patchJson("/api/reservations/{$reservation->id}/dates", [
                'check_in' => now()->addDays(5)->toDateString(),
                'check_out' => now()->addDays(7)->toDateString(),
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Room is not available for reservations.');
    }

    public function test_dates_can_be_changed_when_there_is_no_payment(): void
    {
        $user = User::factory()->create();
        $reservation = $this->reservationFor($user);

        $this->actingAs($user)
            ->patchJson("/api/reservations/{$reservation->id}/dates", [
                'check_in' => now()->addDays(5)->toDateString(),
                'check_out' => now()->addDays(8)->toDateString(),
            ])
            ->assertOk()
            ->assertJsonPath('check_out', now()->addDays(8)->toDateString());
    }

    public function test_dates_cannot_be_changed_while_a_payment_is_in_progress(): void
    {
        $user = User::factory()->create();
        $room = $this->availableRoom();
        $reservationId = $this->actingAs($user)->postJson('/api/reservations', [
            'room_id' => $room->id,
            'check_in' => now()->addDay()->toDateString(),
            'check_out' => now()->addDays(3)->toDateString(),
        ])->json('id');

        $this->actingAs($user)
            ->patchJson("/api/reservations/{$reservationId}/dates", [
                'check_in' => now()->addDays(5)->toDateString(),
                'check_out' => now()->addDays(8)->toDateString(),
            ])
            ->assertStatus(422);
    }

    public function test_unpaid_reservation_releases_its_dates_after_the_hold_expires(): void
    {
        $room = $this->availableRoom();
        $dates = [
            'room_id' => $room->id,
            'check_in' => now()->addDays(3)->toDateString(),
            'check_out' => now()->addDays(5)->toDateString(),
        ];
        $first = User::factory()->create();
        $reservationId = $this->actingAs($first)->postJson('/api/reservations', $dates)->json('id');
        $second = User::factory()->create();

        $this->actingAs($second)
            ->postJson('/api/reservations', $dates)
            ->assertStatus(422);

        $this->travel(Reservation::holdMinutes() + Reservation::EXPIRATION_GRACE_MINUTES + 1)->minutes();

        $this->actingAs($second)
            ->postJson('/api/reservations', $dates)
            ->assertCreated();

        $expired = Reservation::find($reservationId);
        $this->assertSame('expired', $expired->status);
        $this->assertSame('failed', $expired->latestPayment->status);
    }

    public function test_pending_reservation_keeps_its_dates_during_the_grace_period(): void
    {
        $room = $this->availableRoom();
        $dates = [
            'room_id' => $room->id,
            'check_in' => now()->addDays(3)->toDateString(),
            'check_out' => now()->addDays(5)->toDateString(),
        ];
        $this->actingAs(User::factory()->create())->postJson('/api/reservations', $dates);

        $this->travel(Reservation::holdMinutes() + 1)->minutes();

        $this->actingAs(User::factory()->create())
            ->postJson('/api/reservations', $dates)
            ->assertStatus(422);
    }

    private function reservationFor(User $user)
    {
        return $user->reservations()->create([
            'room_id' => $this->availableRoom()->id,
            'check_in' => now()->addDay()->toDateString(),
            'check_out' => now()->addDays(3)->toDateString(),
            'status' => 'confirmed',
        ]);
    }

    private function availableRoom(): Room
    {
        return Room::create([
            'number' => fake()->unique()->numerify('###'),
            'type' => 'double',
            'price' => 125.50,
            'capacity' => 2,
            'status' => 'available',
        ]);
    }
}