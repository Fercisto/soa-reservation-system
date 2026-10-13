<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            // External payments are not tied to a reservation or a user of this system.
            $table->foreignId('reservation_id')->nullable()->change();
            $table->foreignId('user_id')->nullable()->change();

            $table->foreignId('api_client_id')->nullable()->after('user_id')->constrained()->cascadeOnDelete();
            $table->string('external_reference', 100)->nullable()->after('api_client_id');
            $table->string('description')->nullable()->after('external_reference');
            $table->string('customer_email')->nullable()->after('description');
            $table->text('success_url')->nullable()->after('checkout_url');
            $table->text('cancel_url')->nullable()->after('success_url');
            $table->timestamp('expires_at')->nullable()->after('cancel_url');

            $table->index(['api_client_id', 'external_reference']);
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex(['api_client_id', 'external_reference']);
            $table->dropConstrainedForeignId('api_client_id');
            $table->dropColumn([
                'external_reference',
                'description',
                'customer_email',
                'success_url',
                'cancel_url',
                'expires_at',
            ]);
        });
    }
};
