<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServiceLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'service',
        'operation',
        'kind',
        'source',
        'user_id',
        'actor',
        'role',
        'hotel_id',
        'success',
        'status_code',
        'error',
        'duration_ms',
        'ip',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'success' => 'boolean',
            'status_code' => 'integer',
            'duration_ms' => 'integer',
            'occurred_at' => 'datetime',
        ];
    }

    public function hotel(): BelongsTo
    {
        return $this->belongsTo(Hotel::class);
    }
}
