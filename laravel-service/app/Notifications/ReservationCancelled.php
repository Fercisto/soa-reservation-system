<?php

namespace App\Notifications;

use App\Models\Payment;
use App\Models\Reservation;
use App\Models\User;

class ReservationCancelled extends ReservationNotification
{
    public function __construct(
        Reservation $reservation,
        public readonly User $cancelledBy,
        public readonly ?Payment $refundedPayment = null,
    ) {
        parent::__construct($reservation);
    }

    public function databaseType(object $notifiable): string
    {
        return 'reservation_cancelled';
    }

    public function toArray(object $notifiable): array
    {
        return [
            ...parent::toArray($notifiable),
            'cancelled_by' => $this->cancelledBy->role,
            'refunded_amount' => $this->refundedPayment?->amount,
        ];
    }

    protected function title(User $notifiable): string
    {
        return 'Reservación cancelada';
    }

    protected function message(User $notifiable): string
    {
        $byAdmin = $this->cancelledBy->role === 'admin';

        if ($notifiable->role === 'admin') {
            $who = $byAdmin ? "el administrador {$this->cancelledBy->name}" : 'el cliente';

            return trim("La reservación de {$this->reservation->user->name} para {$this->stay()} "
                ."fue cancelada por {$who}. {$this->refundNote(forAdmin: true)}");
        }

        $who = $byAdmin ? ' por el administrador' : '';

        return trim("Tu reservación de {$this->stay()} fue cancelada{$who}. {$this->refundNote(forAdmin: false)}");
    }

    private function refundNote(bool $forAdmin): string
    {
        if (! $this->refundedPayment) {
            return '';
        }

        $amount = $this->money($this->refundedPayment->amount);

        if ($this->refundedPayment->method === 'cash') {
            return $forAdmin
                ? "Se debe devolver {$amount} en efectivo al cliente."
                : "Acude a recepción para recibir tu reembolso de {$amount} en efectivo.";
        }

        return $forAdmin
            ? "Se reembolsaron {$amount} a la tarjeta del cliente."
            : "Se reembolsaron {$amount} a tu tarjeta.";
    }
}
