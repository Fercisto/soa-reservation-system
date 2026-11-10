<?php

namespace Tests\Feature;

use App\Models\Reservation;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminSummaryTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_sees_the_month_and_today_figures(): void
    {
        $this->travelTo(now('America/Mexico_City')->setTime(12, 0));
        $today = now('America/Mexico_City')->toDateString();
        $customer = User::factory()->create();

        $inHouse = $this->paidReservation($customer, $this->room(500), $today, 2);
        $this->paidReservation($customer, $this->room(300), now('America/Mexico_City')->addDays(3)->toDateString(), 1);
        $this->room(800);
        $customer->reservations()->create([
            'room_id' => $this->room(100)->id,
            'check_in' => now('America/Mexico_City')->addDays(10)->toDateString(),
            'check_out' => now('America/Mexico_City')->addDays(11)->toDateString(),
            'status' => 'pending',
            'expires_at' => now()->addMinutes(30),
        ]);

        $this->actingAs($customer)->postJson('/api/invoices', [
            'reservation_id' => $inHouse->id,
            'rfc' => 'MISC491214B86',
            'name' => 'CECILIA MIRANDA SANCHEZ',
            'postal_code' => '01010',
            'tax_regime' => '612',
            'cfdi_use' => 'G03',
        ])->assertCreated();

        $this->actingAs($this->admin())
            ->getJson('/api/admin/summary')
            ->assertOk()
            ->assertJsonPath('today', $today)
            ->assertJsonPath('revenue_month', 1300)
            ->assertJsonPath('payments_month', 2)
            ->assertJsonPath('invoiced_month', 1000)
            ->assertJsonPath('invoices_month', 1)
            ->assertJsonPath('uninvoiced_amount', 300)
            ->assertJsonPath('uninvoiced_count', 1)
            ->assertJsonPath('occupied_rooms', 1)
            ->assertJsonPath('rooms', 4)
            ->assertJsonPath('occupancy_rate', 25)
            ->assertJsonPath('arrivals_today', 1)
            ->assertJsonPath('active_reservations', 2)
            ->assertJsonPath('pending_payments', 1)
            ->assertJsonCount(2, 'upcoming_arrivals');
    }

    public function test_customers_cannot_see_the_summary(): void
    {
        $this->actingAs(User::factory()->create())
            ->getJson('/api/admin/summary')
            ->assertForbidden();
    }

    private function room(float $price): Room
    {
        return Room::create([
            'hotel_id' => $this->hotel()->id,
            'number' => fake()->unique()->numerify('###'),
            'type' => 'double',
            'price' => $price,
            'capacity' => 2,
            'status' => 'available',
        ]);
    }

    private function paidReservation(User $user, Room $room, string $checkIn, int $nights): Reservation
    {
        $reservation = $user->reservations()->create([
            'room_id' => $room->id,
            'check_in' => $checkIn,
            'check_out' => now()->parse($checkIn)->addDays($nights)->toDateString(),
            'status' => 'pending',
        ]);

        $reservation->payments()->create([
            'user_id' => $user->id,
            'amount' => $reservation->totalAmount(),
            'currency' => 'mxn',
            'method' => 'card',
            'status' => 'pending',
            'provider' => 'fake',
        ])->markPaid('fake_pi');

        return $reservation;
    }
}
