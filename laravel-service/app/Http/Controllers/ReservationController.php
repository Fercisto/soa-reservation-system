<?php

namespace App\Http\Controllers;

use App\Models\Reservation;
use App\Models\Room;
use Illuminate\Http\Request;

class ReservationController extends Controller
{
    public function index(Request $request)
    {
        $query = $request->user()->role === 'admin'
            ? Reservation::query()->with(['room', 'user'])
            : $request->user()->reservations()->with('room');

        $reservations = $query
            ->latest('check_in')
            ->get();

        return response()->json($reservations);
    }

    public function show(Request $request, Reservation $reservation)
    {
        return response()->json(
            $this->ownedReservation($request, $reservation)->load('room')
        );
    }

    public function store(Request $request)
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

        if ($this->hasDateConflict($validated['room_id'], $validated['check_in'], $validated['check_out'])) {
            return response()->json([
                'message' => 'Room is already reserved for the selected dates.',
            ], 422);
        }

        $reservation = $request->user()->reservations()->create([
            ...$validated,
            'status' => 'confirmed',
        ]);

        return response()->json($reservation->load('room'), 201);
    }

    public function updateDates(Request $request, Reservation $reservation)
    {
        $reservation = $this->ownedReservation($request, $reservation);

        if ($reservation->status === 'cancelled') {
            return response()->json([
                'message' => 'Cancelled reservations cannot be modified.',
            ], 422);
        }

        $validated = $request->validate([
            'check_in' => 'required|date_format:Y-m-d|after_or_equal:today',
            'check_out' => 'required|date_format:Y-m-d|after:check_in',
        ]);

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

    public function cancel(Request $request, Reservation $reservation)
    {
        $reservation = $this->ownedReservation($request, $reservation);

        if ($reservation->status === 'cancelled') {
            return response()->json([
                'message' => 'Reservation is already cancelled.',
            ], 422);
        }

        $reservation->update(['status' => 'cancelled']);

        return response()->json($reservation->fresh()->load('room'));
    }

    private function ownedReservation(Request $request, Reservation $reservation): Reservation
    {
        abort_unless($reservation->user_id === $request->user()->id, 404);

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
            ->where('status', '!=', 'cancelled')
            ->when($exceptReservationId, fn ($query) => $query->where('id', '!=', $exceptReservationId))
            ->where('check_in', '<', $checkOut)
            ->where('check_out', '>', $checkIn)
            ->exists();
    }
}