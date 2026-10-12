<?php

namespace App\Models;

use App\Payments\PaymentGateway;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Throwable;

class Reservation extends Model
{
    use HasFactory;

    /**
     * Statuses that keep the room blocked for the reserved dates.
     */
    public const ACTIVE_STATUSES = ['pending', 'confirmed'];

    /**
     * Extra minutes a pending reservation keeps its dates after the hold ends,
     * so a payment completed right before the deadline can still be confirmed.
     */
    public const EXPIRATION_GRACE_MINUTES = 10;

    protected $fillable = [
        'user_id',
        'room_id',
        'check_in',
        'check_out',
        'status',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'check_in' => 'date:Y-m-d',
            'check_out' => 'date:Y-m-d',
            'expires_at' => 'datetime',
        ];
    }

    public static function holdMinutes(): int
    {
        return max(31, (int) config('services.payments.hold_minutes'));
    }

    /**
     * Release the dates of pending reservations whose payment window has ended.
     */
    public static function expireStale(): void
    {
        $stale = static::query()
            ->where('status', 'pending')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now()->subMinutes(self::EXPIRATION_GRACE_MINUTES));

        Payment::query()
            ->whereIn('reservation_id', (clone $stale)->select('id'))
            ->where('status', 'pending')
            ->update(['status' => 'failed']);

        $stale->update(['status' => 'expired']);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function latestPayment(): HasOne
    {
        return $this->hasOne(Payment::class)->latestOfMany();
    }

    public function isPaid(): bool
    {
        return $this->payments()->where('status', 'paid')->exists();
    }

    public function nights(): int
    {
        return (int) $this->check_in->diffInDays($this->check_out, true);
    }

    /**
     * Total price of the stay, computed on the server from the room price.
     */
    public function totalAmount(): string
    {
        return number_format((float) $this->room->price * $this->nights(), 2, '.', '');
    }

    /**
     * Create a card payment and its checkout session with the gateway.
     * The hold is extended when it is too short for a new checkout.
     */
    public function startCardPayment(PaymentGateway $gateway): Payment
    {
        if (! $this->expires_at || $this->expires_at->lt(now()->addMinutes(31))) {
            $this->update(['expires_at' => now()->addMinutes(self::holdMinutes())]);
        }

        $payment = $this->payments()->create([
            'user_id' => $this->user_id,
            'amount' => $this->totalAmount(),
            'currency' => config('services.payments.currency'),
            'method' => 'card',
            'status' => 'pending',
            'provider' => $gateway->name(),
        ]);

        try {
            $result = $gateway->createCheckout($payment);
        } catch (Throwable $exception) {
            $payment->update(['status' => 'failed']);

            throw $exception;
        }

        $payment->update([
            'provider_reference' => $result->reference,
            'checkout_url' => $result->checkoutUrl,
        ]);

        return $payment;
    }

    /**
     * Close every unpaid checkout of the reservation.
     */
    public function closePendingCheckouts(PaymentGateway $gateway): void
    {
        $this->payments()
            ->where('status', 'pending')
            ->get()
            ->each(fn (Payment $payment) => $payment->closeCheckout($gateway));
    }
}