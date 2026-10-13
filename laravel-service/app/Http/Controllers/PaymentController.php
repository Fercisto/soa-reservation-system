<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\Reservation;
use App\Payments\InvalidWebhookException;
use App\Payments\PaymentGateway;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Stripe\Exception\ApiErrorException;

class PaymentController extends Controller
{
    public function __construct(private readonly PaymentGateway $gateway)
    {
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string', Rule::in(Payment::STATUSES)],
            'reservation_id' => 'nullable|integer',
        ]);

        Reservation::expireStale();

        $query = $request->user()->role === 'admin'
            ? Payment::query()->with(['reservation.room', 'user'])
            : $request->user()->payments()->with('reservation.room');

        // External systems' payments are served by the /v1/payments API, not here.
        $payments = $query
            ->whereNotNull('reservation_id')
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($validated['reservation_id'] ?? null, fn ($query, $id) => $query->where('reservation_id', $id))
            ->latest()
            ->get();

        return response()->json($payments);
    }

    public function show(Request $request, Payment $payment)
    {
        return response()->json(
            $this->ownedPayment($request, $payment)->load(['reservation.room', 'user'])
        );
    }

    /**
     * Pay a pending reservation. Card payments reuse the open checkout when there is one;
     * cash payments (admin only) close any open checkout and confirm the reservation.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'reservation_id' => 'required|integer|exists:reservations,id',
            'method' => ['sometimes', 'string', Rule::in(Payment::METHODS)],
        ]);

        $method = $validated['method'] ?? 'card';
        $isAdmin = $request->user()->role === 'admin';

        Reservation::expireStale();
        $reservation = Reservation::with('room')->findOrFail($validated['reservation_id']);

        abort_unless($isAdmin || $reservation->user_id === $request->user()->id, 404);

        if ($method === 'cash' && ! $isAdmin) {
            return response()->json([
                'message' => 'Only administrators can register cash payments.',
            ], 403);
        }

        if (! in_array($reservation->status, Reservation::ACTIVE_STATUSES, true)) {
            return response()->json([
                'message' => 'Only active reservations can be paid.',
            ], 422);
        }

        if ($reservation->isPaid()) {
            return response()->json([
                'message' => 'Reservation is already paid.',
            ], 422);
        }

        if ($reservation->status === 'pending' && $reservation->expires_at?->isPast()) {
            return response()->json([
                'message' => 'The payment window for this reservation has ended.',
            ], 422);
        }

        try {
            if ($method === 'cash') {
                $reservation->closePendingCheckouts($this->gateway);

                if ($reservation->isPaid()) {
                    return response()->json([
                        'message' => 'Reservation is already paid.',
                    ], 422);
                }

                $payment = $reservation->payments()->create([
                    'user_id' => $reservation->user_id,
                    'amount' => $reservation->totalAmount(),
                    'currency' => config('services.payments.currency'),
                    'method' => 'cash',
                    'status' => 'pending',
                    'provider' => 'manual',
                ]);
                $payment->markPaid();

                return response()->json($payment->fresh()->load('reservation.room'), 201);
            }

            $openPayment = $reservation->payments()
                ->where('status', 'pending')
                ->whereNotNull('checkout_url')
                ->latest()
                ->first();

            if ($openPayment) {
                return response()->json($openPayment->load('reservation.room'));
            }

            $payment = $reservation->startCardPayment($this->gateway);
        } catch (ApiErrorException $exception) {
            return $this->providerError($exception);
        }

        return response()->json($payment->fresh()->load('reservation.room'), 201);
    }

    public function verify(Request $request, Payment $payment)
    {
        $payment = $this->ownedPayment($request, $payment);

        if ($payment->status === 'pending' && $payment->provider_reference) {
            try {
                $payment->applyGatewayResult($this->gateway->retrieve($payment));
            } catch (ApiErrorException $exception) {
                return $this->providerError($exception);
            }
        }

        return response()->json($payment->fresh()->load('reservation.room'));
    }

    public function webhook(Request $request)
    {
        try {
            $result = $this->gateway->parseWebhook(
                $request->getContent(),
                $request->header('Stripe-Signature')
            );
        } catch (InvalidWebhookException $exception) {
            return response()->json(['message' => $exception->getMessage()], 400);
        }

        if ($result) {
            Payment::where('provider_reference', $result->reference)
                ->first()
                ?->applyGatewayResult($result);
        }

        return response()->json(['received' => true]);
    }

    private function ownedPayment(Request $request, Payment $payment): Payment
    {
        abort_unless(
            $payment->reservation_id
                && ($request->user()->role === 'admin' || $payment->user_id === $request->user()->id),
            404,
            'Payment not found.'
        );

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
