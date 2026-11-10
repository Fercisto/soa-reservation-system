<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Report extends Model
{
    protected $fillable = [
        'user_id',
        'from',
        'to',
        'data',
        'credits',
    ];

    protected function casts(): array
    {
        return [
            'from' => 'date:Y-m-d',
            'to' => 'date:Y-m-d',
            'data' => 'array',
        ];
    }

    public function hotel(): BelongsTo
    {
        return $this->belongsTo(Hotel::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
