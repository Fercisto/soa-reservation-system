<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Campaign extends Model
{
    // past: guests whose stay ended; upcoming: guests with a stay ahead; all: both.
    public const AUDIENCES = ['past', 'upcoming', 'all'];

    protected $fillable = [
        'user_id',
        'audience',
        'title',
        'message',
        'recipients',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
