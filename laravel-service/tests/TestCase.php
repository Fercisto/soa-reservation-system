<?php

namespace Tests;

use App\Models\Hotel;
use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    private ?Hotel $defaultHotel = null;

    /**
     * The hotel most tests work with: Gold plan, active, with credits.
     */
    protected function hotel(): Hotel
    {
        return $this->defaultHotel ??= $this->makeHotel('gold');
    }

    protected function makeHotel(?string $plan = 'gold', int $credits = 50, bool $active = true): Hotel
    {
        $hotel = Hotel::create([
            'name' => 'Hotel '.fake()->unique()->word(),
            'slug' => fake()->unique()->slug(2),
            'city' => 'Aguascalientes',
            'plan' => $plan,
            'plan_expires_at' => $plan ? ($active ? now()->addDays(30) : now()->subDay()) : null,
        ]);

        if ($credits > 0) {
            $hotel->addCredits($credits, 'bonus', 'Saldo de prueba');
        }

        return $hotel;
    }

    protected function admin(?Hotel $hotel = null): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'hotel_id' => ($hotel ?? $this->hotel())->id,
        ]);
    }
}
