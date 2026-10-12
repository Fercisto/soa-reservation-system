<?php

namespace App\Models;

use App\Notifications\ReservationNotifier;
use App\Payments\GatewayResult;
use App\Payments\PaymentGateway;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\DB;
use Stripe\Exception\ApiErrorException;

class Payment extends Model
{
    use HasFactory;

    public const STATUSES = ['pending', 'paid', 'failed', 'refunded'];

    public const METHODS = ['card', 'cash'];

    protected $fillable = [
        'reservation_id',
        'user_id',
        'amount',
        'currency',
        'method',
        'status',
        'provider',
        'provider_reference',
        'provider_payment_intent',
        'checkout_url',
        'paid_at',
    ];

    protected $hidden = [
        'provider_payment_intent',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'paid_at' => 'datetime',
        ];
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Sync the payment with the status reported by the gateway.
     * Paid and refunded payments are final and are not overwritten.
     */
    public function applyGatewayResult(GatewayResult $result): void
    {
        if (in_array($this->status, ['paid', 'refunded'], true)) {
            return;
        }

        if ($result->status === 'paid') {
            $this->markPaid($result->paymentIntent);

            return;
        }

        $this->update(['status' => $result->status]);

        if ($result->status === 'failed') {
            $this->releaseReservationIfUnpaid();
        }
    }

    /**
     * Close the checkout so it cannot be paid anymore. If the provider says it
     * was already completed, the payment is synced instead.
     */
    public function closeCheckout(PaymentGateway $gateway): void
    {
        if ($this->status !== 'pending') {
            return;
        }

        if (! $this->provider_reference) {
            $this->update(['status' => 'failed']);

            return;
        }

        try {
            $gateway->cancelCheckout($this);
        } catch (ApiErrorException) {
            $this->applyGatewayResult($gateway->retrieve($this));

            return;
        }

        $this->update(['status' => 'failed']);
    }

    public function markPaid(?string $paymentIntent = null): void
    {
        $confirmed = DB::transaction(function () use ($paymentIntent) {
            $this->update([
                'status' => 'paid',
                'provider_payment_intent' => $paymentIntent ?? $this->provider_payment_intent,
                'paid_at' => now(),
            ]);

            if ($this->reservation->status !== 'pending') {
                return false;
            }

            $this->reservation->update(['status' => 'confirmed']);

            return true;
        });

        if ($confirmed) {
            ReservationNotifier::confirmed($this->reservation, $this);
        }
    }

    public function refund(PaymentGateway $gateway): void
    {
        if ($this->provider !== 'manual') {
            $gateway->refund($this);
        }

        $this->update(['status' => 'refunded']);
    }

    /**
     * A pending reservation whose only checkout failed or expired gives its dates back.
     */
    private function releaseReservationIfUnpaid(): void
    {
        $reservation = $this->reservation;

        $hasOpenPayments = $reservation->payments()
            ->whereIn('status', ['pending', 'paid'])
            ->exists();

        if ($reservation->status === 'pending' && ! $hasOpenPayments) {
            $reservation->update(['status' => 'expired']);
        }
    }
}
