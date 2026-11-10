<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Turns the single hotel into a multi-tenant platform: every hotel (tenant) has its own
 * admins, rooms, reservations and invoices. Existing data is moved to a first hotel.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hotels', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('city')->nullable();
            $table->text('description')->nullable();
            $table->string('plan', 20)->nullable();
            $table->timestamp('plan_expires_at')->nullable();
            $table->unsignedInteger('credits')->default(0);
            $table->text('restaurant_api_key')->nullable();
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('hotel_id')->nullable()->after('id')->constrained()->nullOnDelete();
        });

        foreach (['rooms', 'reservations', 'invoices'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->foreignId('hotel_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            });
        }

        $this->moveExistingDataToFirstHotel();

        Schema::table('rooms', function (Blueprint $table) {
            $table->dropUnique(['number']);
            $table->unique(['hotel_id', 'number']);
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropUnique(['hotel_id', 'number']);
            $table->unique('number');
        });

        foreach (['invoices', 'reservations', 'rooms', 'users'] as $tableName) {
            Schema::table($tableName, function (Blueprint $table) {
                $table->dropConstrainedForeignId('hotel_id');
            });
        }

        Schema::dropIfExists('hotels');
    }

    private function moveExistingDataToFirstHotel(): void
    {
        $hasData = DB::table('rooms')->exists()
            || DB::table('users')->where('role', 'admin')->exists();

        if (! $hasData) {
            return;
        }

        $hotelId = DB::table('hotels')->insertGetId([
            'name' => 'Hotel Casa Jacaranda',
            'slug' => 'casa-jacaranda',
            'city' => 'Aguascalientes',
            'description' => 'Hotel boutique en el centro de la ciudad.',
            'plan' => 'gold',
            'plan_expires_at' => now()->addDays(30),
            'credits' => 50,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('users')->where('role', 'admin')->update(['hotel_id' => $hotelId]);
        DB::table('rooms')->update(['hotel_id' => $hotelId]);
        DB::table('reservations')->update(['hotel_id' => $hotelId]);
        DB::table('invoices')->update(['hotel_id' => $hotelId]);
    }
};
