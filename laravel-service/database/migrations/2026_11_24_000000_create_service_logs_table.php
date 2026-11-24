<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Log of every use of the platform's services, received through RabbitMQ.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('service_logs', function (Blueprint $table) {
            $table->id();
            $table->string('service', 40);
            $table->string('operation', 100);
            // query / mutation (GraphQL), http (REST API for external systems), worker (consumer).
            $table->string('kind', 20);
            // gateway (NestJS) or worker (Laravel consumer).
            $table->string('source', 20);
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('actor')->nullable();
            $table->string('role', 20)->nullable();
            $table->foreignId('hotel_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('success');
            $table->unsignedSmallInteger('status_code')->nullable();
            $table->string('error')->nullable();
            $table->unsignedInteger('duration_ms');
            $table->string('ip', 45)->nullable();
            $table->timestamp('occurred_at')->index();
            $table->timestamp('created_at')->nullable();

            $table->index(['service', 'occurred_at']);
            $table->index(['success', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('service_logs');
    }
};
