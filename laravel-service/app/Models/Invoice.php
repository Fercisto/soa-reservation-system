<?php

namespace App\Models;

use App\Invoicing\InvoiceGateway;
use App\Invoicing\InvoicingException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invoice extends Model
{
    // "pending" only lasts while the PAC stamps the CFDI.
    public const STATUSES = ['pending', 'issued', 'cancelled'];

    /**
     * SAT cancellation reason "02": receipt issued with errors, without a replacement.
     */
    public const CANCELLATION_REASON = '02';

    protected $fillable = [
        'reservation_id',
        'payment_id',
        'user_id',
        'status',
        'provider',
        'uuid',
        'series',
        'folio',
        'rfc',
        'name',
        'postal_code',
        'tax_regime',
        'cfdi_use',
        'payment_form',
        'subtotal',
        'tax',
        'total',
        'xml',
        'qr_code',
        'issued_at',
        'cancelled_at',
    ];

    // The stamped XML and the QR are only sent when a single invoice is requested.
    protected $hidden = [
        'xml',
        'qr_code',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'tax' => 'decimal:2',
            'total' => 'decimal:2',
            'issued_at' => 'datetime',
            'cancelled_at' => 'datetime',
        ];
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Retry the cancellation of invoices whose reservation was cancelled but the
     * SAT did not accept it yet (a CFDI stamped minutes ago may not be registered).
     */
    public static function retryCancellations(InvoiceGateway $gateway): void
    {
        static::query()
            ->where('status', 'issued')
            ->whereHas('reservation', fn ($query) => $query->where('status', 'cancelled'))
            ->get()
            ->each(fn (Invoice $invoice) => $invoice->cancelWith($gateway));
    }

    /**
     * Cancel the CFDI with the SAT. A failure is reported but does not stop the
     * reservation from being cancelled; the invoice stays issued so it can be retried.
     */
    public function cancelWith(InvoiceGateway $gateway): bool
    {
        try {
            $this->cancel($gateway);
        } catch (InvoicingException $exception) {
            report($exception);

            return false;
        }

        return true;
    }

    /**
     * @throws InvoicingException
     */
    public function cancel(InvoiceGateway $gateway): void
    {
        if ($this->status !== 'issued') {
            return;
        }

        $gateway->cancel($this, self::CANCELLATION_REASON);

        $this->update(['status' => 'cancelled', 'cancelled_at' => now()]);
    }
}
