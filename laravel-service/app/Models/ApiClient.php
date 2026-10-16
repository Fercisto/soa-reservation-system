<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * An external system (e.g. a restaurant) allowed to use the payments service.
 * Only the SHA-256 hash of its API key is stored. Its Stripe secret key, used to
 * charge with its own Stripe account, is stored encrypted.
 */
class ApiClient extends Model
{
    protected $fillable = [
        'name',
        'key_hash',
        'callback_url',
        'callback_secret',
        'stripe_secret',
        'active',
    ];

    protected $hidden = [
        'key_hash',
        'callback_secret',
        'stripe_secret',
    ];

    protected function casts(): array
    {
        return [
            'active' => 'boolean',
            'stripe_secret' => 'encrypted',
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

    public function hasStripeAccount(): bool
    {
        return filled($this->stripe_secret);
    }

    /**
     * Settings the client can see about itself; secrets are never returned in full.
     */
    public function toSettingsArray(): array
    {
        return [
            'name' => $this->name,
            'callback_url' => $this->callback_url,
            'stripe_configured' => $this->hasStripeAccount(),
            'stripe_mode' => match (true) {
                ! $this->hasStripeAccount() => null,
                str_contains($this->stripe_secret, '_live_') => 'live',
                default => 'test',
            },
            'stripe_key_last4' => $this->hasStripeAccount() ? substr($this->stripe_secret, -4) : null,
        ];
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
