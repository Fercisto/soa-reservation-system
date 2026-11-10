<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One movement of a hotel's credits: purchase, bonus, usage of a module or a time pass.
 */
class CreditTransaction extends Model
{
    public const TYPES = ['purchase', 'bonus', 'usage'];

    protected $fillable = [
        'user_id',
        'type',
        'feature',
        'amount',
        'balance_after',
        'description',
        'reference',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'balance_after' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
