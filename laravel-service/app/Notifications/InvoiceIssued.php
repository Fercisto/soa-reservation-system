<?php

namespace App\Notifications;

use App\Models\Invoice;
use App\Models\Reservation;
use App\Models\User;

class InvoiceIssued extends ReservationNotification
{
    public function __construct(Reservation $reservation, public readonly Invoice $invoice)
    {
        parent::__construct($reservation);
    }

    public function databaseType(object $notifiable): string
    {
        return 'invoice_issued';
    }

    public function toArray(object $notifiable): array
    {
        return [
            ...parent::toArray($notifiable),
            'invoice_id' => $this->invoice->id,
            'uuid' => $this->invoice->uuid,
        ];
    }

    protected function title(User $notifiable): string
    {
        return $notifiable->role === 'admin' ? 'Nueva factura' : 'Factura emitida';
    }

    protected function message(User $notifiable): string
    {
        $amount = $this->money($this->invoice->total);

        if ($notifiable->role === 'admin') {
            return "{$this->reservation->user->name} facturó {$this->stay()} por {$amount} "
                ."a nombre de {$this->invoice->name} ({$this->invoice->rfc}). "
                ."Folio {$this->invoice->series}{$this->invoice->folio}.";
        }

        return "Tu factura de {$this->stay()} por {$amount} "
            ."a nombre de {$this->invoice->name} está lista para descargar.";
    }
}
