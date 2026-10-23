<?php

namespace App\Http\Controllers;

use App\Invoicing\CfdiBuilder;
use App\Invoicing\InvoiceGateway;
use App\Invoicing\InvoicingException;
use App\Invoicing\TaxCatalog;
use App\Models\Invoice;
use App\Models\Reservation;
use App\Notifications\ReservationNotifier;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class InvoiceController extends Controller
{
    public function __construct(
        private readonly InvoiceGateway $gateway,
        private readonly CfdiBuilder $builder,
    ) {
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string', Rule::in(Invoice::STATUSES)],
            'reservation_id' => 'nullable|integer',
        ]);

        Invoice::retryCancellations($this->gateway);

        $query = $request->user()->role === 'admin'
            ? Invoice::query()->with(['reservation.room', 'user'])
            : Invoice::query()->where('user_id', $request->user()->id)->with('reservation.room');

        $invoices = $query
            ->where('status', '!=', 'pending')
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($validated['reservation_id'] ?? null, fn ($query, $id) => $query->where('reservation_id', $id))
            ->latest()
            ->get();

        return response()->json($invoices);
    }

    /**
     * A single invoice includes the stamped XML and the QR code.
     */
    public function show(Request $request, Invoice $invoice)
    {
        abort_unless(
            $invoice->status !== 'pending'
                && ($request->user()->role === 'admin' || $invoice->user_id === $request->user()->id),
            404,
            'Invoice not found.'
        );

        return response()->json(
            $invoice->load(['reservation.room', 'user'])->makeVisible(['xml', 'qr_code'])
        );
    }

    /**
     * Cancel an issued CFDI, e.g. when its fiscal data was wrong. The reservation
     * stays paid and can be invoiced again with the right data.
     */
    public function cancel(Request $request, Invoice $invoice)
    {
        abort_unless(
            $invoice->status !== 'pending'
                && ($request->user()->role === 'admin' || $invoice->user_id === $request->user()->id),
            404,
            'Invoice not found.'
        );

        if ($invoice->status !== 'issued') {
            return response()->json([
                'message' => 'Invoice is already cancelled.',
            ], 422);
        }

        try {
            $invoice->cancel($this->gateway);
        } catch (InvoicingException $exception) {
            report($exception);

            return response()->json([
                'message' => 'The invoice could not be cancelled: '.$exception->getMessage(),
            ], 502);
        }

        ReservationNotifier::invoiceCancelled($invoice->reservation, $invoice, $request->user());

        return response()->json($invoice->fresh()->load('reservation.room'));
    }

    /**
     * Issue the CFDI of a paid reservation with the customer's fiscal data.
     */
    public function store(Request $request)
    {
        $request->merge([
            'rfc' => Str::upper(trim((string) $request->input('rfc'))),
            'name' => Str::squish(Str::upper((string) $request->input('name'))),
        ]);

        $validated = $request->validate([
            'reservation_id' => 'required|integer|exists:reservations,id',
            'rfc' => ['required', 'string', 'regex:'.TaxCatalog::RFC_PATTERN],
            'name' => 'required|string|max:254',
            'postal_code' => 'required|digits:5',
            'tax_regime' => ['required', 'string', Rule::in(TaxCatalog::TAX_REGIMES)],
            'cfdi_use' => ['required', 'string', Rule::in(TaxCatalog::CFDI_USES)],
        ], [
            'rfc.regex' => 'The RFC format is not valid.',
        ]);

        $reservation = Reservation::with('room')->findOrFail($validated['reservation_id']);

        abort_unless(
            $request->user()->role === 'admin' || $reservation->user_id === $request->user()->id,
            404
        );

        $payment = $reservation->payments()->where('status', 'paid')->latest()->first();

        if ($reservation->status !== 'confirmed' || ! $payment) {
            return response()->json([
                'message' => 'Only paid reservations can be invoiced.',
            ], 422);
        }

        if ($reservation->invoices()->whereIn('status', ['pending', 'issued'])->exists()) {
            return response()->json([
                'message' => 'Reservation is already invoiced.',
            ], 422);
        }

        $amounts = CfdiBuilder::amounts($payment->amount);

        $invoice = $reservation->invoices()->create([
            ...collect($validated)->except('reservation_id')->all(),
            'payment_id' => $payment->id,
            'user_id' => $reservation->user_id,
            'status' => 'pending',
            'provider' => $this->gateway->name(),
            'series' => config('services.invoicing.series'),
            'folio' => '0',
            'payment_form' => TaxCatalog::PAYMENT_FORMS[$payment->method] ?? '99',
            'subtotal' => $amounts['subtotal'],
            'tax' => $amounts['tax'],
            'total' => $payment->amount,
        ]);
        $invoice->update(['folio' => (string) $invoice->id]);

        $description = "Hospedaje habitación {$reservation->room->number} ({$reservation->room->type}), "
            ."{$reservation->nights()} noches del {$reservation->check_in->toDateString()} "
            ."al {$reservation->check_out->toDateString()}";

        try {
            $issuedAt = now(config('services.hotel.timezone'))->subMinute();
            $result = $this->gateway->stamp(
                $invoice,
                $this->builder->build($invoice, $description, $issuedAt->format('Y-m-d\TH:i:s'))
            );
        } catch (InvoicingException $exception) {
            $invoice->delete();
            report($exception);

            return response()->json([
                'message' => 'The invoice could not be issued: '.$exception->getMessage(),
            ], 502);
        }

        $invoice->update([
            'status' => 'issued',
            'uuid' => $result->uuid,
            'xml' => $result->xml,
            'qr_code' => $result->qrCode,
            'issued_at' => now(),
        ]);

        ReservationNotifier::invoiced($reservation, $invoice, $request->user());

        return response()->json($invoice->fresh()->load('reservation.room'), 201);
    }
}
