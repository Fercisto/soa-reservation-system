<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Time-limited access to a module, paid with credits.
 */
class FeaturePass extends Model
{
    public const UNITS = ['minutes', 'hours', 'days'];

    protected $fillable = [
        'user_id',
        'feature',
        'unit',
        'quantity',
        'credits',
        'starts_at',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Credits a pass costs: minutes are charged in blocks, hours and days per unit.
     */
    public static function cost(string $feature, string $unit, int $quantity): int
    {
        $rate = (int) config("saas.passes.{$feature}.rates.{$unit}");

        if ($unit === 'minutes') {
            return (int) ceil($quantity / config('saas.minutes_block')) * $rate;
        }

        return $quantity * $rate;
    }
}
