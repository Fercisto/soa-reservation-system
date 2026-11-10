<?php

namespace Database\Seeders;

use App\Models\Hotel;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Two demo hotels with different plans, their admins and a guest.
     */
    public function run(): void
    {
        $jacaranda = $this->hotel('casa-jacaranda', [
            'name' => 'Hotel Casa Jacaranda',
            'city' => 'Aguascalientes',
            'description' => 'Hotel boutique en el centro de la ciudad, a pasos de la plaza principal.',
            'plan' => 'gold',
        ], [
            ['101', 'Sencilla', 650, 1],
            ['102', 'Doble', 900, 2],
            ['201', 'Suite', 1500, 4],
        ]);

        $marAzul = $this->hotel('mar-azul', [
            'name' => 'Hotel Mar Azul',
            'city' => 'Mazatlán',
            'description' => 'Frente al malecón, con vista al mar.',
            'plan' => 'bronze',
        ], [
            ['1', 'Doble vista al mar', 1200, 2],
            ['2', 'Familiar', 1700, 5],
        ]);

        $this->user('admin@example.com', 'Admin Casa Jacaranda', 'admin', $jacaranda);
        $this->user('admin@marazul.com', 'Admin Mar Azul', 'admin', $marAzul);
        $this->user('customer@example.com', 'Customer User', 'customer');
    }

    private function hotel(string $slug, array $attributes, array $rooms): Hotel
    {
        $hotel = Hotel::firstOrNew(['slug' => $slug]);
        $isNew = ! $hotel->exists;

        $hotel->fill([...$attributes, 'plan_expires_at' => now()->addDays(config('saas.period_days'))])->save();

        if ($isNew) {
            $hotel->addCredits(50, 'bonus', 'Créditos de bienvenida');
        }

        foreach ($rooms as [$number, $type, $price, $capacity]) {
            $hotel->rooms()->firstOrCreate(['number' => $number], [
                'type' => $type,
                'price' => $price,
                'capacity' => $capacity,
                'status' => 'available',
            ]);
        }

        return $hotel;
    }

    private function user(string $email, string $name, string $role, ?Hotel $hotel = null): void
    {
        User::updateOrCreate(['email' => $email], [
            'name' => $name,
            'password' => Hash::make('password'),
            'role' => $role,
            'hotel_id' => $hotel?->id,
        ]);
    }
}
