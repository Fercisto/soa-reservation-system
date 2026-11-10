<?php

namespace Tests\Feature;

use App\Models\Hotel;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SaasTest extends TestCase
{
    use RefreshDatabase;

    public function test_home_page_lists_plans_and_active_hotels(): void
    {
        $active = $this->makeHotel('silver');
        $this->makeHotel('gold', active: false);
        $this->makeHotel(null);

        $this->getJson('/api/plans')
            ->assertOk()
            ->assertJsonPath('plans.0.id', 'bronze')
            ->assertJsonPath('plans.2.features.6', 'restaurant')
            ->assertJsonPath('credit_features.0.id', 'invoice');

        $this->getJson('/api/hotels')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.slug', $active->slug);
    }

    public function test_hotel_signs_up_and_pays_its_plan(): void
    {
        $response = $this->postJson('/api/hotels', [
            'hotel_name' => 'Hotel Las Palmas',
            'city' => 'Cancún',
            'name' => 'Ana Admin',
            'email' => 'ana@laspalmas.test',
            'password' => 'secret123',
            'password_confirmation' => 'secret123',
            'plan' => 'gold',
        ])
            ->assertCreated()
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonPath('user.hotel.slug', 'hotel-las-palmas')
            ->assertJsonPath('user.hotel.plan_active', false)
            ->assertJsonPath('payment.purpose', 'subscription')
            ->assertJsonPath('payment.amount', '1999.00');

        $admin = User::where('email', 'ana@laspalmas.test')->first();

        $this->actingAs($admin)
            ->postJson("/api/billing/payments/{$response->json('payment.id')}/verify")
            ->assertOk()
            ->assertJsonPath('status', 'paid');

        $hotel = $admin->hotel->fresh();
        $this->assertTrue($hotel->plan_active);
        $this->assertSame('gold', $hotel->plan);
        $this->assertSame(50, $hotel->credits);
        $this->assertSame('bonus', $hotel->creditTransactions()->first()->type);

        // Verifying again does not add the bonus twice.
        $this->actingAs($admin)->postJson("/api/billing/payments/{$response->json('payment.id')}/verify");
        $this->assertSame(50, $hotel->fresh()->credits);
    }

    public function test_renewing_extends_the_plan_and_changing_it_starts_now(): void
    {
        $hotel = $this->makeHotel('silver', credits: 0);
        $admin = $this->admin($hotel);
        $expires = $hotel->plan_expires_at;

        $this->payPlatform($admin, '/api/billing/subscription', ['plan' => 'silver']);
        $this->assertEqualsWithDelta($expires->addDays(30)->timestamp, $hotel->fresh()->plan_expires_at->timestamp, 2);

        $this->payPlatform($admin, '/api/billing/subscription', ['plan' => 'bronze']);
        $this->assertSame('bronze', $hotel->fresh()->plan);
        $this->assertEqualsWithDelta(now()->addDays(30)->timestamp, $hotel->fresh()->plan_expires_at->timestamp, 2);
    }

    public function test_hotel_buys_credits_and_the_ledger_records_it(): void
    {
        $hotel = $this->makeHotel('bronze', credits: 0);
        $admin = $this->admin($hotel);

        $this->payPlatform($admin, '/api/billing/credits', ['package' => 'business']);

        $this->assertSame(150, $hotel->fresh()->credits);

        $this->actingAs($admin)
            ->getJson('/api/billing/transactions')
            ->assertOk()
            ->assertJsonPath('0.type', 'purchase')
            ->assertJsonPath('0.amount', 150)
            ->assertJsonPath('0.balance_after', 150);

        $this->actingAs($admin)
            ->getJson('/api/billing/payments')
            ->assertJsonPath('0.purpose', 'credits')
            ->assertJsonPath('0.status', 'paid');
    }

    public function test_plan_decides_which_modules_an_admin_can_use(): void
    {
        $this->actingAs($this->admin($this->makeHotel('bronze')))
            ->getJson('/api/admin/summary')
            ->assertForbidden()
            ->assertJsonPath('message', 'Your plan does not include this module. Upgrade your plan to use it.');

        $this->actingAs($this->admin($this->makeHotel('silver')))
            ->getJson('/api/admin/summary')
            ->assertOk();

        $expiredAdmin = $this->admin($this->makeHotel('gold', active: false));

        $this->actingAs($expiredAdmin)->getJson('/api/rooms')->assertStatus(402);
        $this->actingAs($expiredAdmin)->getJson('/api/hotel')->assertOk()->assertJsonPath('plan_active', false);
        $this->actingAs($expiredAdmin)->postJson('/api/billing/subscription', ['plan' => 'gold'])->assertCreated();

        $this->actingAs(User::factory()->create())->getJson('/api/billing/transactions')->assertForbidden();
    }

    public function test_bronze_plan_limits_the_number_of_rooms(): void
    {
        $hotel = $this->makeHotel('bronze');
        $admin = $this->admin($hotel);

        foreach (range(1, 10) as $number) {
            $hotel->rooms()->create(['number' => (string) $number, 'type' => 'doble', 'price' => 500, 'capacity' => 2]);
        }

        $this->actingAs($admin)
            ->postJson('/api/rooms', ['number' => '11', 'type' => 'doble', 'price' => 500, 'capacity' => 2])
            ->assertForbidden()
            ->assertJsonPath('message', 'Your Bronze plan allows up to 10 rooms. Upgrade your plan to add more.');
    }

    public function test_hotels_do_not_see_each_others_data(): void
    {
        $other = $this->makeHotel('gold');
        $otherRoom = $other->rooms()->create(['number' => '1', 'type' => 'doble', 'price' => 500, 'capacity' => 2]);
        $this->hotel()->rooms()->create(['number' => '1', 'type' => 'doble', 'price' => 500, 'capacity' => 2]);
        $reservation = User::factory()->create()->reservations()->create([
            'room_id' => $otherRoom->id,
            'check_in' => now()->addDay()->toDateString(),
            'check_out' => now()->addDays(2)->toDateString(),
            'status' => 'confirmed',
        ]);
        $admin = $this->admin();

        $this->assertSame($other->id, $reservation->hotel_id);
        $this->actingAs($admin)->getJson('/api/rooms')->assertJsonCount(1);
        $this->actingAs($admin)->getJson('/api/reservations')->assertJsonCount(0);
        $this->actingAs($admin)->patchJson("/api/reservations/{$reservation->id}/cancel")->assertNotFound();
        $this->actingAs($admin)->putJson("/api/rooms/{$otherRoom->id}", [
            'number' => '9', 'type' => 'x', 'price' => 1, 'capacity' => 1, 'status' => 'available',
        ])->assertNotFound();

        $this->getJson("/api/hotels/{$other->slug}/rooms/available")->assertJsonCount(1);
    }

    public function test_hotel_without_active_plan_does_not_accept_reservations(): void
    {
        $hotel = $this->makeHotel('gold', active: false);
        $room = $hotel->rooms()->create(['number' => '1', 'type' => 'doble', 'price' => 500, 'capacity' => 2]);

        $this->actingAs(User::factory()->create())
            ->postJson('/api/reservations', [
                'room_id' => $room->id,
                'check_in' => now()->addDay()->toDateString(),
                'check_out' => now()->addDays(2)->toDateString(),
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This hotel is not accepting reservations.');

        $this->getJson("/api/hotels/{$hotel->slug}")->assertNotFound();
    }

    public function test_each_invoice_costs_one_credit(): void
    {
        $hotel = $this->makeHotel('bronze', credits: 1);
        $customer = User::factory()->create();
        $payload = [
            'rfc' => 'MISC491214B86',
            'name' => 'CECILIA MIRANDA SANCHEZ',
            'postal_code' => '01010',
            'tax_regime' => '612',
            'cfdi_use' => 'G03',
        ];

        $this->actingAs($customer)
            ->postJson('/api/invoices', ['reservation_id' => $this->paidReservation($hotel, $customer)->id, ...$payload])
            ->assertCreated();

        $this->assertSame(0, $hotel->fresh()->credits);
        $this->assertSame('invoice', $hotel->creditTransactions()->latest('id')->first()->feature);

        $this->actingAs($customer)
            ->postJson('/api/invoices', ['reservation_id' => $this->paidReservation($hotel, $customer)->id, ...$payload])
            ->assertStatus(402)
            ->assertJsonPath('message', 'The hotel cannot issue invoices right now. Please contact the hotel.');
    }

    public function test_report_costs_credits_and_downloads_as_pdf(): void
    {
        $hotel = $this->makeHotel('bronze', credits: 4);
        $admin = $this->admin($hotel);
        $this->paidReservation($hotel, User::factory()->create());
        $period = ['from' => now()->toDateString(), 'to' => now()->addDays(10)->toDateString()];

        $id = $this->actingAs($admin)
            ->postJson('/api/reports', $period)
            ->assertCreated()
            ->assertJsonPath('credits', 3)
            ->assertJsonPath('data.booked_nights', 2)
            ->json('id');

        $this->assertSame(1, $hotel->fresh()->credits);

        $this->actingAs($admin)
            ->get("/api/reports/{$id}/pdf")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $this->actingAs($admin)
            ->postJson('/api/reports', $period)
            ->assertStatus(402);

        $this->actingAs($this->admin())->getJson("/api/reports/{$id}")->assertNotFound();
    }

    public function test_time_pass_opens_a_module_until_it_expires(): void
    {
        $hotel = $this->makeHotel('bronze', credits: 20);
        $admin = $this->admin($hotel);

        $this->actingAs($admin)->getJson('/api/analytics')->assertStatus(402);

        $this->actingAs($admin)
            ->postJson('/api/billing/passes', ['feature' => 'analytics', 'unit' => 'minutes', 'quantity' => 20])
            ->assertStatus(422);

        $this->actingAs($admin)
            ->postJson('/api/billing/passes', ['feature' => 'analytics', 'unit' => 'minutes', 'quantity' => 30])
            ->assertCreated()
            ->assertJsonPath('pass.credits', 2)
            ->assertJsonPath('hotel.credits', 18);

        $this->actingAs($admin)->getJson('/api/analytics')->assertOk()->assertJsonCount(12, 'months');

        // Buying again extends the running pass.
        $this->actingAs($admin)
            ->postJson('/api/billing/passes', ['feature' => 'analytics', 'unit' => 'hours', 'quantity' => 1])
            ->assertCreated();
        $this->assertEqualsWithDelta(
            now()->addMinutes(90)->timestamp,
            $hotel->passEndsAt('analytics')->timestamp,
            2
        );

        $this->travel(91)->minutes();
        $this->actingAs($admin)->getJson('/api/analytics')->assertStatus(402);

        $this->actingAs($admin)
            ->postJson('/api/billing/passes', ['feature' => 'campaigns', 'unit' => 'days', 'quantity' => 2])
            ->assertStatus(402);
        $this->assertSame(16, $hotel->fresh()->credits);
    }

    public function test_campaign_reaches_the_hotels_guests(): void
    {
        $hotel = $this->makeHotel('bronze', credits: 20);
        $admin = $this->admin($hotel);
        $guest = User::factory()->create();
        $this->paidReservation($hotel, $guest);
        $this->paidReservation($this->makeHotel('gold'), $otherGuest = User::factory()->create());

        $this->actingAs($admin)
            ->postJson('/api/billing/passes', ['feature' => 'campaigns', 'unit' => 'hours', 'quantity' => 1])
            ->assertCreated();

        $this->actingAs($admin)
            ->getJson('/api/campaigns')
            ->assertJsonPath('audiences.upcoming', 1)
            ->assertJsonPath('audiences.past', 0);

        $this->actingAs($admin)
            ->postJson('/api/campaigns', ['audience' => 'past', 'title' => 'Promo', 'message' => 'Vuelve'])
            ->assertStatus(422);

        $this->actingAs($admin)
            ->postJson('/api/campaigns', ['audience' => 'all', 'title' => '20% de descuento', 'message' => 'Solo este mes.'])
            ->assertCreated()
            ->assertJsonPath('recipients', 1);

        $this->assertSame("{$hotel->name}: 20% de descuento", $guest->notifications()->where('type', 'hotel_campaign')->first()->data['title']);
        $this->assertSame(0, $otherGuest->notifications()->where('type', 'hotel_campaign')->count());
    }

    public function test_gateway_gets_the_restaurant_key_of_gold_hotels_only(): void
    {
        config(['services.gateway.secret' => 'test-secret']);
        $gold = $this->makeHotel('gold');
        $gold->update(['restaurant_api_key' => 'key-gold']);
        $bronze = $this->makeHotel('bronze');
        $bronze->update(['restaurant_api_key' => 'key-bronze']);

        $this->getJson("/api/internal/hotels/{$gold->slug}/restaurant")->assertUnauthorized();

        $this->getJson("/api/internal/hotels/{$gold->slug}/restaurant", ['X-Gateway-Secret' => 'test-secret'])
            ->assertOk()
            ->assertJsonPath('enabled', true)
            ->assertJsonPath('api_key', 'key-gold');

        $this->getJson("/api/internal/hotels/{$bronze->slug}/restaurant", ['X-Gateway-Secret' => 'test-secret'])
            ->assertJsonPath('enabled', false)
            ->assertJsonPath('api_key', null);

        $this->actingAs($this->admin($gold))
            ->getJson('/api/hotel')
            ->assertJsonMissingPath('restaurant_api_key')
            ->assertJsonPath('restaurant_configured', true);
    }

    public function test_reservation_notifications_go_to_the_hotels_admins_only(): void
    {
        $hotel = $this->makeHotel('gold');
        $ownAdmin = $this->admin($hotel);
        $otherAdmin = $this->admin($this->makeHotel('gold'));

        $this->paidReservation($hotel, User::factory()->create());

        $this->assertSame(1, $ownAdmin->notifications()->count());
        $this->assertSame(0, $otherAdmin->notifications()->count());
    }

    private function payPlatform(User $admin, string $url, array $data): void
    {
        $id = $this->actingAs($admin)->postJson($url, $data)->assertCreated()->json('id');

        $this->actingAs($admin)
            ->postJson("/api/billing/payments/{$id}/verify")
            ->assertOk()
            ->assertJsonPath('status', 'paid');
    }

    private function paidReservation(Hotel $hotel, User $guest): Reservation
    {
        $room = $hotel->rooms()->create([
            'number' => fake()->unique()->numerify('###'),
            'type' => 'doble',
            'price' => 500,
            'capacity' => 2,
        ]);

        $reservation = $guest->reservations()->create([
            'room_id' => $room->id,
            'check_in' => now()->addDay()->toDateString(),
            'check_out' => now()->addDays(3)->toDateString(),
            'status' => 'pending',
        ]);

        $reservation->payments()->create([
            'user_id' => $guest->id,
            'amount' => $reservation->totalAmount(),
            'currency' => 'mxn',
            'method' => 'card',
            'status' => 'pending',
            'provider' => 'fake',
        ])->markPaid('fake_pi');

        return $reservation->fresh();
    }
}
