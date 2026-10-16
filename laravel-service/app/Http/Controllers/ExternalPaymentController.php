<?php

namespace App\Http\Controllers;

use App\Models\ApiClient;
use App\Models\Payment;
use App\Payments\PaymentGateway;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Stripe\Exception\ApiErrorException;

/**
 * Generic payments API for external systems. It knows nothing about reservations:
 * the client sends its own reference, description and amount, and is charged
 * through its own Stripe account (registered with PUT /v1/settings).
 */
class ExternalPaymentController extends Controller
{
    public function __construct(private readonly PaymentGateway $gateway)
    {
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'reference' => 'nullable|string|max:100',
            'status' => ['nullable', 'string', Rule::in(Payment::STATUSES)],
        ]);

        $payments = $this->client($request)->payments()
            ->when($validated['reference'] ?? null, fn ($query, $reference) => $query->where('external_reference', $reference))
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->latest()
            ->limit(50)
            ->get();

        return response()->json($payments->map->toExternalArray());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'reference' => 'required|string|max:100',
            'description' => 'required|string|max:255',
            // Stripe's minimum charge in MXN is $10.00.
            'amount' => 'required|numeric|min:10|max:999999.99',
            'currency' => ['sometimes', 'string', Rule::in(['mxn', 'usd'])],
            'customer_email' => 'nullable|email',
            'success_url' => 'required|url',
            'cancel_url' => 'required|url',
        ]);

        $client = $this->client($request);

        if ($this->gateway->name() === 'stripe' && ! $client->hasStripeAccount()) {
            return response()->json([
                'message' => 'Register your Stripe secret key first (PUT /v1/settings).',
            ], 422);
        }

        // Idempotent by reference: retrying the same order returns its open or paid payment.
        $existing = $client->payments()
            ->where('external_reference', $validated['reference'])
            ->whereIn('status', ['pending', 'paid'])
            ->latest()
            ->first();

        if ($existing) {
            return response()->json($existing->toExternalArray());
        }

        $payment = $client->payments()->create([
            'external_reference' => $validated['reference'],
            'description' => $validated['description'],
            'customer_email' => $validated['customer_email'] ?? null,
            'amount' => number_format((float) $validated['amount'], 2, '.', ''),
            'currency' => $validated['currency'] ?? config('services.payments.currency'),
            'method' => 'card',
            'status' => 'pending',
            'provider' => $this->gateway->name(),
            'success_url' => $validated['success_url'],
            'cancel_url' => $validated['cancel_url'],
        ]);

        try {
            $result = $this->gateway->createCheckout($payment);
        } catch (ApiErrorException $exception) {
            $payment->update(['status' => 'failed']);

            return $this->providerError($exception);
        }

        $payment->update([
            'provider_reference' => $result->reference,
            'checkout_url' => $result->checkoutUrl,
        ]);

        return response()->json($payment->fresh()->toExternalArray(), 201);
    }

    public function show(Request $request, int $payment)
    {
        return response()->json($this->find($request, $payment)->toExternalArray());
    }

    public function verify(Request $request, int $payment)
    {
        $payment = $this->find($request, $payment);

        if ($payment->status === 'pending' && $payment->provider_reference) {
            try {
                $payment->applyGatewayResult($this->gateway->retrieve($payment));
            } catch (ApiErrorException $exception) {
                return $this->providerError($exception);
            }
        }

        return response()->json($payment->fresh()->toExternalArray());
    }

    public function cancel(Request $request, int $payment)
    {
        $payment = $this->find($request, $payment);

        if ($payment->status !== 'pending') {
            return response()->json(['message' => 'Only pending payments can be cancelled.'], 422);
        }

        try {
            $payment->closeCheckout($this->gateway);
        } catch (ApiErrorException $exception) {
            return $this->providerError($exception);
        }

        return response()->json($payment->fresh()->toExternalArray());
    }

    public function refund(Request $request, int $payment)
    {
        $payment = $this->find($request, $payment);

        if ($payment->status !== 'paid') {
            return response()->json(['message' => 'Only paid payments can be refunded.'], 422);
        }

        try {
            $payment->refund($this->gateway);
        } catch (ApiErrorException $exception) {
            return $this->providerError($exception);
        }

        return response()->json($payment->fresh()->toExternalArray());
    }

    private function client(Request $request): ApiClient
    {
        return $request->attributes->get('api_client');
    }

    private function find(Request $request, int $id): Payment
    {
        $payment = $this->client($request)->payments()->find($id);

        abort_unless($payment, 404, 'Payment not found.');

        return $payment;
    }

    private function providerError(ApiErrorException $exception)
    {
        report($exception);

        return response()->json([
            'message' => 'Payment provider error: '.$exception->getMessage(),
        ], 502);
    }
}
