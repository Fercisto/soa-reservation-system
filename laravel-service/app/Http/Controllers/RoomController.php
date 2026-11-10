<?php

namespace App\Http\Controllers;

use App\Models\Room;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Rooms of the admin's hotel. Guests list a hotel's rooms through HotelController.
 */
class RoomController extends Controller
{
    private const STATUSES = ['available', 'occupied', 'maintenance', 'inactive'];

    public function index(Request $request)
    {
        return response()->json(
            $request->user()->hotel->rooms()->orderBy('number')->get()
        );
    }

    public function show(Room $room)
    {
        return response()->json($room);
    }

    public function store(Request $request)
    {
        $hotel = $request->user()->hotel;

        $validated = $request->validate([
            'number' => ['required', 'string', 'max:50', Rule::unique('rooms', 'number')->where('hotel_id', $hotel->id)],
            'type' => 'required|string|max:100',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'capacity' => 'required|integer|min:1',
            'features' => 'nullable|array',
            'status' => ['sometimes', 'string', Rule::in(self::STATUSES)],
        ]);

        if ($hotel->room_limit !== null && $hotel->rooms()->count() >= $hotel->room_limit) {
            return response()->json([
                'message' => "Your {$hotel->plan_name} plan allows up to {$hotel->room_limit} rooms. Upgrade your plan to add more.",
            ], 403);
        }

        $room = $hotel->rooms()->create([
            ...$validated,
            'status' => $validated['status'] ?? 'available',
        ]);

        return response()->json($room, 201);
    }

    public function updateStatus(Request $request, Room $room)
    {
        $room = $this->owned($request, $room);

        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in(self::STATUSES)],
        ]);

        $room->update(['status' => $validated['status']]);

        return response()->json($room->fresh());
    }

    public function update(Request $request, Room $room)
    {
        $room = $this->owned($request, $room);

        $validated = $request->validate([
            'number' => [
                'required', 'string', 'max:50',
                Rule::unique('rooms', 'number')->where('hotel_id', $room->hotel_id)->ignore($room->id),
            ],
            'type' => 'required|string|max:100',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'capacity' => 'required|integer|min:1',
            'features' => 'nullable|array',
            'status' => ['required', 'string', Rule::in(self::STATUSES)],
        ]);

        $room->update($validated);

        return response()->json($room->fresh());
    }

    public function destroy(Request $request, Room $room)
    {
        $room = $this->owned($request, $room);

        if ($room->reservations()->exists()) {
            return response()->json([
                'message' => 'Rooms with reservations cannot be deleted.',
            ], 409);
        }

        $room->delete();

        return response()->noContent();
    }

    private function owned(Request $request, Room $room): Room
    {
        abort_unless($room->hotel_id === $request->user()->hotel_id, 404, 'Room not found.');

        return $room;
    }
}
