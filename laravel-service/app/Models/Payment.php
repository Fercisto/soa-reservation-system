<?php

namespace App\Models;

use App\Notifications\ReservationNotifier;
use App\Payments\ClientCallback;
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
        'api_client_id',
        'external_reference',
        'description',
        'customer_email',
        'amount',
        'currency',
        'method',
        'status',
        'provider',
        'provider_reference',
        'provider_payment_intent',
        'checkout_url',
        'success_url',
        'cancel_url',
        'expires_at',
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
            'expires_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        // External systems learn about status changes through their callback URL.
        static::updated(function (Payment $payment) {
            if ($payment->api_client_id && $payment->wasChanged('status')) {
                DB::afterCommit(fn () => ClientCallback::send($payment));
            }
        });
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function apiClient(): BelongsTo
    {
        return $this->belongsTo(ApiClient::class);
    }

    /**
     * Public representation used by the external payments API and its callbacks.
     */
    public function toExternalArray(): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->external_reference,
            'description' => $this->description,
            'amount' => (float) $this->amount,
            'currency' => $this->currency,
            'status' => $this->status,
            'customer_email' => $this->customer_email,
            'checkout_url' => $this->status === 'pending' ? $this->checkout_url : null,
            'paid_at' => $this->paid_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
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

            if ($this->reservation?->status !== 'pending') {
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

        if (! $reservation) {
            return;
        }

        $hasOpenPayments = $reservation->payments()
            ->whereIn('status', ['pending', 'paid'])
            ->exists();

        if ($reservation->status === 'pending' && ! $hasOpenPayments) {
            $reservation->update(['status' => 'expired']);
        }
    }
}
