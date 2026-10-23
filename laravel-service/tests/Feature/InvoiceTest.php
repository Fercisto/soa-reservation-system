<?php

namespace Tests\Feature;

use App\Invoicing\InvoiceGateway;
use App\Invoicing\InvoicingException;
use App\Invoicing\StampResult;
use App\Models\Invoice;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InvoiceTest extends TestCase
{
    use RefreshDatabase;

    private const FISCAL_DATA = [
        'rfc' => 'misc491214b86',
        'name' => 'cecilia  miranda sanchez',
        'postal_code' => '01010',
        'tax_regime' => '612',
        'cfdi_use' => 'G03',
    ];

    public function test_customer_can_invoice_a_paid_reservation(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->paidReservationFor($customer, nights: 2, price: 500);

        $response = $this->actingAs($customer)
            ->postJson('/api/invoices', ['reservation_id' => $reservation->id, ...self::FISCAL_DATA])
            ->assertCreated()
            ->assertJsonPath('status', 'issued')
            ->assertJsonPath('rfc', 'MISC491214B86')
            ->assertJsonPath('name', 'CECILIA MIRANDA SANCHEZ')
            ->assertJsonPath('payment_form', '04')
            ->assertJsonPath('subtotal', '862.07')
            ->assertJsonPath('tax', '137.93')
            ->assertJsonPath('total', '1000.00')
            ->assertJsonMissingPath('xml');

        $this->assertNotNull($response->json('uuid'));
        $this->assertTrue($customer->notifications()->where('type', 'invoice_issued')->exists());

        $this->actingAs($customer)
            ->getJson("/api/invoices/{$response->json('id')}")
            ->assertOk()
            ->assertJsonPath('uuid', $response->json('uuid'));

        $this->actingAs($customer)
            ->getJson('/api/reservations')
            ->assertJsonPath('0.invoice.uuid', $response->json('uuid'));
    }

    public function test_stamped_xml_has_the_customer_and_amounts(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->paidReservationFor($customer, nights: 3, price: 150);

        $id = $this->actingAs($customer)
            ->postJson('/api/invoices', ['reservation_id' => $reservation->id, ...self::FISCAL_DATA])
            ->assertCreated()
            ->json('id');

        $xml = simplexml_load_string(Invoice::findOrFail($id)->xml);
        $xml->registerXPathNamespace('cfdi', 'http://www.sat.gob.mx/cfd/4');

        $this->assertSame('450.00', (string) $xml['Total']);
        $this->assertSame('387.93', (string) $xml['SubTotal']);
        $this->assertSame((string) $id, (string) $xml['Folio']);
        $this->assertSame('MISC491214B86', (string) $xml->xpath('//cfdi:Receptor')[0]['Rfc']);
        $this->assertSame('62.07', (string) $xml->xpath('//cfdi:Comprobante/cfdi:Impuestos')[0]['TotalImpuestosTrasladados']);
    }

    public function test_admins_are_notified_about_new_invoices(): void
    {
        $customer = User::factory()->create();
        $admin = User::factory()->create(['role' => 'admin']);
        $reservation = $this->paidReservationFor($customer);

        $this->actingAs($customer)
            ->postJson('/api/invoices', ['reservation_id' => $reservation->id, ...self::FISCAL_DATA])
            ->assertCreated();

        $notification = $admin->notifications()->where('type', 'invoice_issued')->first();

        $this->assertSame('Nueva factura', $notification->data['title']);
        $this->assertStringContainsString('MISC491214B86', $notification->data['message']);
    }

    public function test_admin_who_issues_the_invoice_is_not_notified(): void
    {
        $customer = User::factory()->create();
        $admin = User::factory()->create(['role' => 'admin']);
        $reservation = $this->paidReservationFor($customer);

        $this->actingAs($admin)
            ->postJson('/api/invoices', ['reservation_id' => $reservation->id, ...self::FISCAL_DATA])
            ->assertCreated();

        $this->assertFalse($admin->notifications()->where('type', 'invoice_issued')->exists());
        $this->assertTrue($customer->notifications()->where('type', 'invoice_issued')->exists());
    }

    public function test_wrong_invoice_can_be_cancelled_and_issued_again(): void
    {
        $customer = User::factory()->create();
        $admin = User::factory()->create(['role' => 'admin']);
        $reservation = $this->paidReservationFor($customer);
        $payload = ['reservation_id' => $reservation->id, ...self::FISCAL_DATA];

        $id = $this->actingAs($customer)->postJson('/api/invoices', $payload)->json('id');

        $this->actingAs($customer)
            ->postJson("/api/invoices/{$id}/cancel")
            ->assertOk()
            ->assertJsonPath('status', 'cancelled');

        $this->assertSame('confirmed', $reservation->fresh()->status);
        $this->assertTrue($admin->notifications()->where('type', 'invoice_cancelled')->exists());
        $this->assertFalse($customer->notifications()->where('type', 'invoice_cancelled')->exists());

        $this->actingAs($customer)
            ->postJson("/api/invoices/{$id}/cancel")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Invoice is already cancelled.');

        $newId = $this->actingAs($customer)
            ->postJson('/api/invoices', [...$payload, 'cfdi_use' => 'S01'])
            ->assertCreated()
            ->json('id');

        $this->actingAs($customer)
            ->getJson('/api/reservations')
            ->assertJsonPath('0.invoice.id', $newId);
    }

    public function test_customer_cannot_cancel_another_customers_invoice(): void
    {
        $owner = User::factory()->create();
        $id = $this->actingAs($owner)->postJson('/api/invoices', [
            'reservation_id' => $this->paidReservationFor($owner)->id,
            ...self::FISCAL_DATA,
        ])->json('id');

        $this->actingAs(User::factory()->create())
            ->postJson("/api/invoices/{$id}/cancel")
            ->assertNotFound();

        $this->actingAs(User::factory()->create(['role' => 'admin']))
            ->postJson("/api/invoices/{$id}/cancel")
            ->assertOk();

        $this->assertTrue($owner->notifications()->where('type', 'invoice_cancelled')->exists());
    }

    public function test_reservation_can_only_be_invoiced_once(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->paidReservationFor($customer);
        $payload = ['reservation_id' => $reservation->id, ...self::FISCAL_DATA];

        $this->actingAs($customer)->postJson('/api/invoices', $payload)->assertCreated();

        $this->actingAs($customer)
            ->postJson('/api/invoices', $payload)
            ->assertStatus(422)
            ->assertJsonPath('message', 'Reservation is already invoiced.');
    }

    public function test_unpaid_reservation_cannot_be_invoiced(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->reservationFor($customer);

        $this->actingAs($customer)
            ->postJson('/api/invoices', ['reservation_id' => $reservation->id, ...self::FISCAL_DATA])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Only paid reservations can be invoiced.');
    }

    public function test_customer_cannot_invoice_another_customers_reservation(): void
    {
        $reservation = $this->paidReservationFor(User::factory()->create());

        $this->actingAs(User::factory()->create())
            ->postJson('/api/invoices', ['reservation_id' => $reservation->id, ...self::FISCAL_DATA])
            ->assertNotFound();
    }

    public function test_fiscal_data_is_validated(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->paidReservationFor($customer);

        $this->actingAs($customer)
            ->postJson('/api/invoices', [
                'reservation_id' => $reservation->id,
                'rfc' => 'ABC123',
                'name' => 'Cliente',
                'postal_code' => '123',
                'tax_regime' => '999',
                'cfdi_use' => 'P01',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['rfc', 'postal_code', 'tax_regime', 'cfdi_use']);
    }

    public function test_rejected_invoice_returns_the_pac_message_and_can_be_retried(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->paidReservationFor($customer);
        $this->app->instance(InvoiceGateway::class, new class implements InvoiceGateway
        {
            public function name(): string
            {
                return 'test';
            }

            public function stamp(Invoice $invoice, string $xml): StampResult
            {
                throw new InvoicingException('CFDI40143 - Este RFC del receptor no existe.');
            }

            public function cancel(Invoice $invoice, string $reason): void
            {
            }
        });

        $this->actingAs($customer)
            ->postJson('/api/invoices', ['reservation_id' => $reservation->id, ...self::FISCAL_DATA])
            ->assertStatus(502)
            ->assertJsonPath('message', 'The invoice could not be issued: CFDI40143 - Este RFC del receptor no existe.');

        $this->assertSame(0, Invoice::count());
    }

    public function test_cancelling_an_invoiced_reservation_cancels_the_invoice(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->paidReservationFor($customer);

        $id = $this->actingAs($customer)
            ->postJson('/api/invoices', ['reservation_id' => $reservation->id, ...self::FISCAL_DATA])
            ->json('id');

        $this->actingAs($customer)
            ->patchJson("/api/reservations/{$reservation->id}/cancel")
            ->assertOk()
            ->assertJsonPath('invoice.status', 'cancelled');

        $this->assertSame('cancelled', Invoice::findOrFail($id)->status);
    }

    public function test_cancellation_rejected_by_the_sat_is_retried_later(): void
    {
        $customer = User::factory()->create();
        $reservation = $this->paidReservationFor($customer);
        $id = $this->actingAs($customer)
            ->postJson('/api/invoices', ['reservation_id' => $reservation->id, ...self::FISCAL_DATA])
            ->json('id');

        $gateway = new class implements InvoiceGateway
        {
            public bool $available = false;

            public function name(): string
            {
                return 'test';
            }

            public function stamp(Invoice $invoice, string $xml): StampResult
            {
                throw new InvoicingException('Not used.');
            }

            public function cancel(Invoice $invoice, string $reason): void
            {
                if (! $this->available) {
                    throw new InvoicingException('The invoicing service rejected the request (code 330203).');
                }
            }
        };
        $this->app->instance(InvoiceGateway::class, $gateway);

        $this->actingAs($customer)
            ->patchJson("/api/reservations/{$reservation->id}/cancel")
            ->assertOk()
            ->assertJsonPath('status', 'cancelled')
            ->assertJsonPath('invoice.status', 'issued');

        $gateway->available = true;

        $this->actingAs($customer)
            ->getJson('/api/invoices')
            ->assertJsonPath('0.status', 'cancelled');

        $this->assertNotNull(Invoice::findOrFail($id)->cancelled_at);
    }

    public function test_admin_sees_all_invoices_and_customer_only_their_own(): void
    {
        $customer = User::factory()->create();

        foreach ([$customer, User::factory()->create()] as $user) {
            $this->actingAs($user)->postJson('/api/invoices', [
                'reservation_id' => $this->paidReservationFor($user)->id,
                ...self::FISCAL_DATA,
            ])->assertCreated();
        }

        $this->actingAs($customer)->getJson('/api/invoices')->assertOk()->assertJsonCount(1);

        $this->actingAs(User::factory()->create(['role' => 'admin']))
            ->getJson('/api/invoices')
            ->assertOk()
            ->assertJsonCount(2);
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

    private function paidReservationFor(User $user, int $nights = 2, float $price = 100): Reservation
    {
        $reservation = $this->reservationFor($user, $nights, $price);

        $reservation->payments()->create([
            'user_id' => $reservation->user_id,
            'amount' => $reservation->totalAmount(),
            'currency' => 'mxn',
            'method' => 'card',
            'status' => 'pending',
            'provider' => 'fake',
        ])->markPaid('fake_pi');

        return $reservation;
    }
}
