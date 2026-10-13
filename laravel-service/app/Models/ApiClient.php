<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * An external system (e.g. a restaurant) allowed to use the payments service.
 * Only the SHA-256 hash of its API key is stored.
 */
class ApiClient extends Model
{
    protected $fillable = [
        'name',
        'key_hash',
        'callback_url',
        'callback_secret',
        'active',
    ];

    protected $hidden = [
        'key_hash',
        'callback_secret',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
        ];
    }

    /**
     * Register a client and return it with its plain API key, which is shown only once.
     *
     * @return array{0: ApiClient, 1: string}
     */
    public static function register(string $name, ?string $callbackUrl = null): array
    {
        $apiKey = 'ck_'.Str::random(40);

        $client = static::create([
            'name' => $name,
            'key_hash' => hash('sha256', $apiKey),
            'callback_url' => $callbackUrl,
            'callback_secret' => 'cbs_'.Str::random(40),
        ]);

        return [$client, $apiKey];
    }

    public static function findActiveByKey(?string $apiKey): ?self
    {
        if (! $apiKey) {
            return null;
        }

        return static::where('key_hash', hash('sha256', $apiKey))
            ->where('active', true)
            ->first();
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(ExternalRecipient::class);
    }
}
