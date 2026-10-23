<?php

namespace App\Notifications;

use App\Models\Invoice;
use App\Models\Reservation;
use App\Models\User;

class InvoiceCancelled extends ReservationNotification
{
    public function __construct(
        Reservation $reservation,
        public readonly Invoice $invoice,
        public readonly User $cancelledBy,
    ) {
        parent::__construct($reservation);
    }

    public function databaseType(object $notifiable): string
    {
        return 'invoice_cancelled';
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
        return 'Factura cancelada';
    }

    protected function message(User $notifiable): string
    {
        $folio = "{$this->invoice->series}{$this->invoice->folio}";

        if ($notifiable->role === 'admin') {
            $who = $this->cancelledBy->role === 'admin'
                ? "el administrador {$this->cancelledBy->name}"
                : 'el cliente';

            return "La factura {$folio} de {$this->reservation->user->name} "
                ."({$this->invoice->rfc}) fue cancelada por {$who}.";
        }

        return "Tu factura {$folio} de {$this->stay()} fue cancelada ante el SAT. "
            .'Puedes volver a facturar la reservación con los datos correctos.';
    }
}
