<?php

namespace App\Http\Controllers;

use App\Models\Room;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RoomController extends Controller
{
    public function index()
    {
        return response()->json(Room::query()->latest()->get());
    }

    public function available()
    {
        return response()->json(
            Room::query()->where('status', 'available')->latest()->get()
        );
    }

    public function show(Room $room)
    {
        return response()->json($room);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'number' => 'required|string|max:50|unique:rooms,number',
            'type' => 'required|string|max:100',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'capacity' => 'required|integer|min:1',
            'features' => 'nullable|array',
            'status' => ['sometimes', 'string', Rule::in(['available', 'occupied', 'maintenance', 'inactive'])],
        ]);

        $room = Room::create([
            ...$validated,
            'status' => $validated['status'] ?? 'available',
        ]);

        return response()->json($room, 201);
    }

    public function updateStatus(Request $request, Room $room)
    {
        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in(['available', 'occupied', 'maintenance', 'inactive'])],
        ]);

        $room->update(['status' => $validated['status']]);

        return response()->json($room->fresh());
    }
}