<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Platform billing: hotels pay their subscription and buy credits through the same
 * payments table, spend credits on special modules and buy time passes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('hotel_id')->nullable()->after('user_id')->constrained()->cascadeOnDelete();
            // reservation (a guest pays a stay), subscription or credits (a hotel pays the platform).
            $table->string('purpose', 20)->default('reservation')->after('hotel_id')->index();
            $table->json('metadata')->nullable()->after('purpose');
        });

        // Ledger of every credit movement, so each balance can be explained.
        Schema::create('credit_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hotel_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 20);
            $table->string('feature', 30)->nullable();
            $table->integer('amount');
            $table->unsignedInteger('balance_after');
            $table->string('description');
            $table->string('reference', 100)->nullable();
            $table->timestamps();

            $table->index(['hotel_id', 'created_at']);
        });

        Schema::create('feature_passes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hotel_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('feature', 30);
            $table->string('unit', 10);
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('credits');
            $table->timestamp('starts_at');
            $table->timestamp('expires_at');
            $table->timestamps();

            $table->index(['hotel_id', 'feature', 'expires_at']);
        });

        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hotel_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->date('from');
            $table->date('to');
            $table->json('data');
            $table->unsignedInteger('credits');
            $table->timestamps();
        });

        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hotel_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('audience', 20);
            $table->string('title');
            $table->text('message');
            $table->unsignedInteger('recipients');
            $table->timestamps();
        });

        // Opening balance of hotels that already had credits.
        DB::table('hotels')->where('credits', '>', 0)->get()->each(function ($hotel) {
            DB::table('credit_transactions')->insert([
                'hotel_id' => $hotel->id,
                'type' => 'bonus',
                'amount' => $hotel->credits,
                'balance_after' => $hotel->credits,
                'description' => 'Saldo inicial',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('campaigns');
        Schema::dropIfExists('reports');
        Schema::dropIfExists('feature_passes');
        Schema::dropIfExists('credit_transactions');

        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('hotel_id');
            $table->dropIndex(['purpose']);
            $table->dropColumn(['purpose', 'metadata']);
        });
    }
};
