<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoomTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_register_a_room(): void
    {
        $this->actingAs(User::factory()->create())
            ->postJson('/api/rooms', [
                'number' => '101',
                'type' => 'double',
                'description' => 'Room with balcony',
                'price' => 125.50,
                'capacity' => 2,
                'features' => ['balcony', 'wifi'],
            ])
            ->assertCreated()
            ->assertJsonPath('number', '101')
            ->assertJsonPath('status', 'available');

        $this->assertDatabaseHas('rooms', [
            'number' => '101',
            'status' => 'available',
        ]);
    }

    public function test_available_rooms_are_listed(): void
    {
        Room::create([
            'number' => '201',
            'type' => 'single',
            'price' => 80,
            'capacity' => 1,
            'status' => 'available',
        ]);
        Room::create([
            'number' => '202',
            'type' => 'single',
            'price' => 80,
            'capacity' => 1,
            'status' => 'occupied',
        ]);

        $this->getJson('/api/rooms/available')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.number', '201');
    }

    public function test_authenticated_user_can_change_room_status(): void
    {
        $room = Room::create([
            'number' => '301',
            'type' => 'suite',
            'price' => 250,
            'capacity' => 4,
            'status' => 'available',
        ]);

        $this->actingAs(User::factory()->create())
            ->patchJson("/api/rooms/{$room->id}/status", ['status' => 'maintenance'])
            ->assertOk()
            ->assertJsonPath('status', 'maintenance');

        $this->assertDatabaseHas('rooms', [
            'id' => $room->id,
            'status' => 'maintenance',
        ]);
    }
}