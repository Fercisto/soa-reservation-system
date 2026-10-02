<?php

namespace Tests\Feature;

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
            ->assertJsonPath('status', 'confirmed')
            ->assertJsonPath('room.id', $room->id);

        $reservationId = $createResponse->json('id');

        $this->actingAs($user)
            ->getJson("/api/reservations/{$reservationId}")
            ->assertOk()
            ->assertJsonPath('check_in', '2026-11-10');

        $this->actingAs($user)
            ->patchJson("/api/reservations/{$reservationId}/dates", [
                'check_in' => '2026-11-12',
                'check_out' => '2026-11-18',
            ])
            ->assertOk()
            ->assertJsonPath('check_out', '2026-11-18');

        $this->actingAs($user)
            ->patchJson("/api/reservations/{$reservationId}/cancel")
            ->assertOk()
            ->assertJsonPath('status', 'cancelled');

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