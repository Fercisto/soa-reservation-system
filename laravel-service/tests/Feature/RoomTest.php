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
        $this->actingAs($this->admin())
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
            'hotel_id' => $this->hotel()->id,
            'number' => '201',
            'type' => 'single',
            'price' => 80,
            'capacity' => 1,
            'status' => 'available',
        ]);
        Room::create([
            'hotel_id' => $this->hotel()->id,
            'number' => '202',
            'type' => 'single',
            'price' => 80,
            'capacity' => 1,
            'status' => 'occupied',
        ]);

        $this->getJson('/api/hotels/'.$this->hotel()->slug.'/rooms/available')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.number', '201');
    }

    public function test_reserved_room_stays_available_outside_its_reserved_dates(): void
    {
        $room = Room::create([
            'hotel_id' => $this->hotel()->id,
            'number' => '501',
            'type' => 'double',
            'price' => 100,
            'capacity' => 2,
            'status' => 'available',
        ]);
        $room->reservations()->create([
            'user_id' => User::factory()->create()->id,
            'check_in' => $this->day(40),
            'check_out' => $this->day(45),
            'status' => 'confirmed',
        ]);

        $this->getJson('/api/hotels/'.$this->hotel()->slug.'/rooms/available')
            ->assertOk()
            ->assertJsonCount(1);

        $this->getJson('/api/hotels/'.$this->hotel()->slug.'/rooms/available?check_in='.$this->day(42).'&check_out='.$this->day(48))
            ->assertOk()
            ->assertJsonCount(0);

        $this->getJson('/api/hotels/'.$this->hotel()->slug.'/rooms/available?check_in='.$this->day(45).'&check_out='.$this->day(48))
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.number', '501');
    }

    public function test_authenticated_user_can_change_room_status(): void
    {
        $room = Room::create([
            'hotel_id' => $this->hotel()->id,
            'number' => '301',
            'type' => 'suite',
            'price' => 250,
            'capacity' => 4,
            'status' => 'available',
        ]);

        $this->actingAs($this->admin())
            ->patchJson("/api/rooms/{$room->id}/status", ['status' => 'maintenance'])
            ->assertOk()
            ->assertJsonPath('status', 'maintenance');

        $this->assertDatabaseHas('rooms', [
            'id' => $room->id,
            'status' => 'maintenance',
        ]);
    }

    public function test_customer_cannot_manage_rooms(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'customer']))
            ->postJson('/api/rooms', [
                'number' => '401',
                'type' => 'single',
                'price' => 80,
                'capacity' => 1,
            ])
            ->assertForbidden();
    }

    private function day(int $offset): string
    {
        return now()->addDays($offset)->toDateString();
    }
}
