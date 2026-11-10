<?php

namespace App\Models;

use App\Saas\InsufficientCreditsException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * A tenant of the platform. Its plan decides which modules its admins can use.
 */
class Hotel extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'city',
        'description',
        'plan',
        'plan_expires_at',
        'credits',
        'restaurant_api_key',
    ];

    protected $hidden = [
        'restaurant_api_key',
    ];

    protected $appends = [
        'plan_name',
        'plan_active',
        'features',
        'room_limit',
    ];

    protected function casts(): array
    {
        return [
            'plan_expires_at' => 'datetime',
            'credits' => 'integer',
            'restaurant_api_key' => 'encrypted',
        ];
    }

    public static function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'hotel';
        $slug = $base;

        for ($suffix = 2; static::where('slug', $slug)->exists(); $suffix++) {
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }

    public function admins(): HasMany
    {
        return $this->hasMany(User::class)->where('role', 'admin');
    }

    public function rooms(): HasMany
    {
        return $this->hasMany(Room::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    public function creditTransactions(): HasMany
    {
        return $this->hasMany(CreditTransaction::class);
    }

    public function featurePasses(): HasMany
    {
        return $this->hasMany(FeaturePass::class);
    }

    public function scopeActive($query)
    {
        return $query->whereNotNull('plan')->where('plan_expires_at', '>', now());
    }

    public function getPlanActiveAttribute(): bool
    {
        return $this->plan !== null && $this->plan_expires_at?->isFuture() === true;
    }

    public function getPlanNameAttribute(): ?string
    {
        return $this->plan ? config("saas.plans.{$this->plan}.name") : null;
    }

    /**
     * Modules of the current plan; none while the subscription is not active.
     */
    public function getFeaturesAttribute(): array
    {
        return $this->plan_active ? config("saas.plans.{$this->plan}.features", []) : [];
    }

    public function getRoomLimitAttribute(): ?int
    {
        return $this->plan ? config("saas.plans.{$this->plan}.room_limit") : null;
    }

    public function hasFeature(string $feature): bool
    {
        return in_array($feature, $this->features, true);
    }

    public function activePass(string $feature): ?FeaturePass
    {
        return $this->featurePasses()
            ->where('feature', $feature)
            ->where('starts_at', '<=', now())
            ->where('expires_at', '>', now())
            ->latest('expires_at')
            ->first();
    }

    /**
     * When access to a module ends. Passes bought while another runs are chained after it.
     */
    public function passEndsAt(string $feature): ?Carbon
    {
        $end = $this->featurePasses()
            ->where('feature', $feature)
            ->where('expires_at', '>', now())
            ->max('expires_at');

        return $end ? Carbon::parse($end) : null;
    }

    /**
     * Passes still running, keyed by feature, for the admin panel.
     */
    public function activePasses(): array
    {
        return $this->featurePasses()
            ->where('expires_at', '>', now())
            ->orderBy('expires_at')
            ->get()
            ->keyBy('feature')
            ->map(fn (FeaturePass $pass) => $pass->expires_at->toISOString())
            ->all();
    }

    public function addCredits(int $amount, string $type, string $description, ?User $user = null, ?string $reference = null): CreditTransaction
    {
        return $this->moveCredits($amount, $type, null, $description, $user, $reference);
    }

    /**
     * @throws InsufficientCreditsException
     */
    public function spendCredits(int $amount, string $feature, string $description, ?User $user = null, ?string $reference = null): CreditTransaction
    {
        return $this->moveCredits(-$amount, 'usage', $feature, $description, $user, $reference);
    }

    /**
     * Change the balance and record the movement in the ledger, atomically.
     */
    private function moveCredits(int $amount, string $type, ?string $feature, string $description, ?User $user, ?string $reference): CreditTransaction
    {
        return DB::transaction(function () use ($amount, $type, $feature, $description, $user, $reference) {
            $hotel = static::whereKey($this->id)->lockForUpdate()->firstOrFail();
            $balance = $hotel->credits + $amount;

            if ($balance < 0) {
                throw new InsufficientCreditsException($hotel->credits, -$amount);
            }

            $hotel->update(['credits' => $balance]);
            $this->credits = $balance;

            return $hotel->creditTransactions()->create([
                'user_id' => $user?->id,
                'type' => $type,
                'feature' => $feature,
                'amount' => $amount,
                'balance_after' => $balance,
                'description' => $description,
                'reference' => $reference,
            ]);
        });
    }
}
