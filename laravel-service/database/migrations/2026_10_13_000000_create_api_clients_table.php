<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_clients', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('key_hash', 64)->unique();
            $table->string('callback_url')->nullable();
            $table->string('callback_secret');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_clients');
    }
};
