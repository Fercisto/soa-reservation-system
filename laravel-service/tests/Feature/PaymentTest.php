<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\User;
use App\Payments\PaymentGateway;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_pay_a_reservation_by_card(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->reservationFor($customer, nights: 3, price: 150);

        $createResponse = $this->actingAs($customer)
            ->postJson('/api/payments', ['reservation_id' => $reservation->id])
            ->assertCreated()
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('method', 'card')
            ->assertJsonPath('provider', 'fake')
            ->assertJsonPath('amount', '450.00');

        $this->assertNotNull($createResponse->json('checkout_url'));
        $this->assertSame('pending', $reservation->fresh()->status);

        $this->actingAs($customer)
            ->postJson("/api/payments/{$createResponse->json('id')}/verify")
            ->assertOk()
            ->assertJsonPath('status', 'paid')
            ->assertJsonPath('reservation.status', 'confirmed');
    }

    public function test_reservation_cannot_be_paid_twice(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->reservationFor($customer);
        $this->paidPaymentFor($reservation);

        $this->actingAs($customer)
            ->postJson('/api/payments', ['reservation_id' => $reservation->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Reservation is already paid.');
    }

    public function test_cancelled_reservation_cannot_be_paid(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->reservationFor($customer);
        $reservation->update(['status' => 'cancelled']);

        $this->actingAs($customer)
            ->postJson('/api/payments', ['reservation_id' => $reservation->id])
            ->assertStatus(422);
    }

    public function test_customer_cannot_pay_another_customers_reservation(): void
    {
        $reservation = $this->reservationFor(User::factory()->create());

        $this->actingAs(User::factory()->create())
            ->postJson('/api/payments', ['reservation_id' => $reservation->id])
            ->assertNotFound();
    }

    public function test_only_admin_can_register_cash_payments(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->reservationFor($customer);

        $this->actingAs($customer)
            ->postJson('/api/payments', ['reservation_id' => $reservation->id, 'method' => 'cash'])
            ->assertForbidden();

        $this->actingAs(User::factory()->create(['role' => 'admin']))
            ->postJson('/api/payments', ['reservation_id' => $reservation->id, 'method' => 'cash'])
            ->assertCreated()
            ->assertJsonPath('status', 'paid')
            ->assertJsonPath('provider', 'manual');

        $this->assertSame('confirmed', $reservation->fresh()->status);
    }

    public function test_webhook_marks_payment_as_paid(): void
    {
        $reservation = $this->reservationFor(User::factory()->create());
        $payment = $reservation->payments()->create([
            'user_id' => $reservation->user_id,
            'amount' => $reservation->totalAmount(),
            'currency' => 'mxn',
            'method' => 'card',
            'status' => 'pending',
            'provider' => 'fake',
            'provider_reference' => 'fake_session_1',
        ]);

        $this->postJson('/api/payments/webhook', ['reference' => 'fake_session_1', 'status' => 'paid'])
            ->assertOk();

        $this->assertSame('paid', $payment->fresh()->status);
        $this->assertSame('confirmed', $reservation->fresh()->status);
    }

    public function test_cancelling_a_paid_reservation_refunds_the_payment(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->reservationFor($customer);
        $payment = $this->paidPaymentFor($reservation);

        $this->actingAs($customer)
            ->patchJson("/api/reservations/{$reservation->id}/cancel")
            ->assertOk()
            ->assertJsonPath('status', 'cancelled');

        $this->assertSame('refunded', $payment->fresh()->status);
    }

    public function test_paid_reservation_dates_cannot_be_changed(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->reservationFor($customer);
        $this->paidPaymentFor($reservation);

        $this->actingAs($customer)
            ->patchJson("/api/reservations/{$reservation->id}/dates", [
                'check_in' => now()->addDays(10)->toDateString(),
                'check_out' => now()->addDays(12)->toDateString(),
            ])
            ->assertStatus(422);
    }

    public function test_admin_sees_all_payments_and_customer_only_their_own(): void
    {
        $customer = User::factory()->create();
        $this->paidPaymentFor($this->reservationFor($customer));
        $this->paidPaymentFor($this->reservationFor(User::factory()->create()));

        $this->actingAs($customer)
            ->getJson('/api/payments')
            ->assertOk()
            ->assertJsonCount(1);

        $this->actingAs(User::factory()->create(['role' => 'admin']))
            ->getJson('/api/payments?status=paid')
            ->assertOk()
            ->assertJsonCount(2);
    }

    public function test_paying_again_returns_the_open_checkout(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->reservationFor($customer);

        $firstId = $this->actingAs($customer)
            ->postJson('/api/payments', ['reservation_id' => $reservation->id])
            ->assertCreated()
            ->json('id');

        $this->actingAs($customer)
            ->postJson('/api/payments', ['reservation_id' => $reservation->id])
            ->assertOk()
            ->assertJsonPath('id', $firstId);

        $this->assertSame(1, $reservation->payments()->count());
    }

    public function test_reservation_cannot_be_paid_after_its_payment_window(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->reservationFor($customer);
        $reservation->update(['expires_at' => now()->subMinute()]);

        $this->actingAs($customer)
            ->postJson('/api/payments', ['reservation_id' => $reservation->id])
            ->assertStatus(422)
            ->assertJsonPath('message', 'The payment window for this reservation has ended.');
    }

    public function test_expired_checkout_webhook_releases_the_reservation(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->reservationFor($customer);
        $payment = $reservation->startCardPayment(app(PaymentGateway::class));

        $this->postJson('/api/payments/webhook', ['reference' => $payment->provider_reference, 'status' => 'failed'])
            ->assertOk();

        $this->assertSame('failed', $payment->fresh()->status);
        $this->assertSame('expired', $reservation->fresh()->status);
    }

    public function test_cash_payment_closes_the_open_card_checkout(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->reservationFor($customer);
        $cardPaymentId = $this->actingAs($customer)
            ->postJson('/api/payments', ['reservation_id' => $reservation->id])
            ->json('id');

        $this->actingAs(User::factory()->create(['role' => 'admin']))
            ->postJson('/api/payments', ['reservation_id' => $reservation->id, 'method' => 'cash'])
            ->assertCreated()
            ->assertJsonPath('status', 'paid');

        $this->assertSame('failed', Payment::find($cardPaymentId)->status);
        $this->assertSame('confirmed', $reservation->fresh()->status);
    }

    private function reservationFor(User $user, int $nights = 2, float $price = 100): Reservation
    {
        $room = Room::create([
            'number' => fake()->unique()->numerify('###'),
            'type' => 'double',
            'price' => $price,
            'capacity' => 2,
            'status' => 'available',
        ]);

        return $user->reservations()->create([
            'room_id' => $room->id,
            'check_in' => now()->addDay()->toDateString(),
            'check_out' => now()->addDays(1 + $nights)->toDateString(),
            'status' => 'pending',
        ]);
    }

    private function paidPaymentFor(Reservation $reservation): Payment
    {
        $payment = $reservation->payments()->create([
            'user_id' => $reservation->user_id,
            'amount' => $reservation->totalAmount(),
            'currency' => 'mxn',
            'method' => 'card',
            'status' => 'pending',
            'provider' => 'fake',
            'provider_reference' => 'fake_'.$reservation->id,
        ]);
        $payment->markPaid('fake_pi');

        return $payment;
    }
}
