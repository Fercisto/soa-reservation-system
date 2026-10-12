<?php

namespace App\Notifications;

use App\Models\Payment;
use App\Models\Reservation;
use App\Models\User;

class ReservationConfirmed extends ReservationNotification
{
    public function __construct(Reservation $reservation, public readonly Payment $payment)
    {
        parent::__construct($reservation);
    }

    public function databaseType(object $notifiable): string
    {
        return 'reservation_confirmed';
    }

    protected function title(User $notifiable): string
    {
        return $notifiable->role === 'admin' ? 'Nueva reservación' : 'Reservación confirmada';
    }

    protected function message(User $notifiable): string
    {
        $method = $this->payment->method === 'cash' ? 'en efectivo' : 'con tarjeta';
        $amount = $this->money($this->payment->amount);

        if ($notifiable->role === 'admin') {
            return "{$this->reservation->user->name} reservó {$this->stay()}. Pagó {$amount} {$method}.";
        }

        return "Tu reservación de {$this->stay()} está confirmada. Recibimos tu pago de {$amount} {$method}.";
    }
}
