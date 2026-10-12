<?php

namespace App\Http\Controllers;

use App\Models\Reservation;
use App\Models\Room;
use App\Notifications\ReservationNotifier;
use App\Payments\PaymentGateway;
use Illuminate\Http\Request;
use Stripe\Exception\ApiErrorException;

class ReservationController extends Controller
{
    public function index(Request $request)
    {
        Reservation::expireStale();

        $query = $request->user()->role === 'admin'
            ? Reservation::query()->with(['room', 'user', 'latestPayment'])
            : $request->user()->reservations()->with(['room', 'latestPayment']);

        $reservations = $query
            ->latest('check_in')
            ->get();

        return response()->json($reservations);
    }

    public function show(Request $request, Reservation $reservation)
    {
        Reservation::expireStale();

        return response()->json(
            $this->ownedReservation($request, $reservation)
                ->refresh()
                ->load(['room', 'user', 'latestPayment'])
        );
    }

    /**
     * Reserve and pay in one step: the reservation holds its dates as "pending"
     * while the customer completes the checkout returned in latest_payment.checkout_url.
     */
    public function store(Request $request, PaymentGateway $gateway)
    {
        $validated = $request->validate([
            'room_id' => 'required|integer|exists:rooms,id',
            'check_in' => 'required|date_format:Y-m-d|after_or_equal:today',
            'check_out' => 'required|date_format:Y-m-d|after:check_in',
        ]);

        $room = Room::findOrFail($validated['room_id']);

        if ($room->status !== 'available') {
            return response()->json([
                'message' => 'Room is not available for reservations.',
            ], 422);
        }

        Reservation::expireStale();

        if ($this->hasDateConflict($validated['room_id'], $validated['check_in'], $validated['check_out'])) {
            return response()->json([
                'message' => 'Room is already reserved for the selected dates.',
            ], 422);
        }

        $reservation = $request->user()->reservations()->create([
            ...$validated,
            'status' => 'pending',
            'expires_at' => now()->addMinutes(Reservation::holdMinutes()),
        ]);

        try {
            $reservation->startCardPayment($gateway);
        } catch (ApiErrorException $exception) {
            report($exception);
            $reservation->delete();

            return response()->json([
                'message' => 'The payment could not be started: '.$exception->getMessage(),
            ], 502);
        }

        return response()->json($reservation->load(['room', 'latestPayment']), 201);
    }

    public function updateDates(Request $request, Reservation $reservation)
    {
        $reservation = $this->ownedReservation($request, $reservation);

        if (! in_array($reservation->status, Reservation::ACTIVE_STATUSES, true)) {
            return response()->json([
                'message' => 'Only active reservations can be modified.',
            ], 422);
        }

        if ($reservation->payments()->whereIn('status', ['pending', 'paid'])->exists()) {
            return response()->json([
                'message' => 'Reservations with a payment in progress or completed cannot be modified.',
            ], 422);
        }

        $validated = $request->validate([
            'check_in' => 'required|date_format:Y-m-d|after_or_equal:today',
            'check_out' => 'required|date_format:Y-m-d|after:check_in',
        ]);

        if ($reservation->room->status !== 'available') {
            return response()->json([
                'message' => 'Room is not available for reservations.',
            ], 422);
        }

        if ($this->hasDateConflict(
            $reservation->room_id,
            $validated['check_in'],
            $validated['check_out'],
            $reservation->id
        )) {
            return response()->json([
                'message' => 'Room is already reserved for the selected dates.',
            ], 422);
        }

        $reservation->update($validated);

        return response()->json($reservation->fresh()->load('room'));
    }

    public function cancel(Request $request, Reservation $reservation, PaymentGateway $gateway)
    {
        $reservation = $this->ownedReservation($request, $reservation);

        if (! in_array($reservation->status, Reservation::ACTIVE_STATUSES, true)) {
            return response()->json([
                'message' => 'Reservation is no longer active.',
            ], 422);
        }

        $wasConfirmed = $reservation->status === 'confirmed';
        $paidPayment = $reservation->payments()->where('status', 'paid')->latest()->first();

        try {
            $reservation->closePendingCheckouts($gateway);
            $paidPayment?->refund($gateway);
        } catch (ApiErrorException $exception) {
            report($exception);

            return response()->json([
                'message' => 'The payment could not be cancelled or refunded: '.$exception->getMessage(),
            ], 502);
        }

        $reservation->update(['status' => 'cancelled']);

        // Unpaid reservations abandoned at checkout don't produce notifications.
        if ($wasConfirmed) {
            ReservationNotifier::cancelled($reservation, $request->user(), $paidPayment);
        }

        return response()->json($reservation->fresh()->load(['room', 'latestPayment']));
    }

    private function ownedReservation(Request $request, Reservation $reservation): Reservation
    {
        abort_unless(
            $request->user()->role === 'admin' || $reservation->user_id === $request->user()->id,
            404
        );

        return $reservation;
    }

    private function hasDateConflict(
        int $roomId,
        string $checkIn,
        string $checkOut,
        ?int $exceptReservationId = null
    ): bool {
        return Reservation::query()
            ->where('room_id', $roomId)
            ->whereIn('status', Reservation::ACTIVE_STATUSES)
            ->when($exceptReservationId, fn ($query) => $query->where('id', '!=', $exceptReservationId))
            ->where('check_in', '<', $checkOut)
            ->where('check_out', '>', $checkIn)
            ->exists();
    }
}