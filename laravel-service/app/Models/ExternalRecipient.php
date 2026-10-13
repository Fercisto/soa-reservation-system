<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Notifications\Notifiable;

/**
 * A user of an external system (e.g. "mesero-12" of the restaurant) that can
 * receive notifications. It is identified by the client's own id, so the
 * external system never needs accounts in this one.
 */
class ExternalRecipient extends Model
{
    use Notifiable;

    protected $fillable = [
        'api_client_id',
        'external_id',
    ];

    public function apiClient(): BelongsTo
    {
        return $this->belongsTo(ApiClient::class);
    }
}
