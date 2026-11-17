<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Demo hotels on every plan, with their admins, guests and activity.
     */
    public function run(): void
    {
        $this->call(DemoDataSeeder::class);
    }
}
