<?php

namespace App\Notifications;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\User;
use App\Messaging\NotificationBus;

/**
 * Decides who is notified about reservation events: the customer and the admins.
 * The notifications travel through RabbitMQ (see NotificationBus).
 */
class ReservationNotifier
{
    public static function confirmed(Reservation $reservation, Payment $payment): void
    {
        $notification = new ReservationConfirmed($reservation, $payment);

        NotificationBus::send($reservation->user, $notification);
        NotificationBus::send(self::admins($reservation), $notification);
    }

    public static function cancelled(Reservation $reservation, User $cancelledBy, ?Payment $refundedPayment): void
    {
        $notification = new ReservationCancelled($reservation, $cancelledBy, $refundedPayment);

        NotificationBus::send($reservation->user, $notification);
        NotificationBus::send(self::admins($reservation)->except($cancelledBy->id), $notification);
    }

    public static function invoiced(Reservation $reservation, Invoice $invoice, User $requestedBy): void
    {
        $notification = new InvoiceIssued($reservation, $invoice);

        NotificationBus::send($reservation->user, $notification);
        NotificationBus::send(self::admins($reservation)->except($requestedBy->id), $notification);
    }

    public static function invoiceCancelled(Reservation $reservation, Invoice $invoice, User $cancelledBy): void
    {
        $notification = new InvoiceCancelled($reservation, $invoice, $cancelledBy);

        if ($reservation->user_id !== $cancelledBy->id) {
            NotificationBus::send($reservation->user, $notification);
        }

        NotificationBus::send(self::admins($reservation)->except($cancelledBy->id), $notification);
    }

    private static function admins(Reservation $reservation)
    {
        return User::where('role', 'admin')->where('hotel_id', $reservation->hotel_id)->get();
    }
}
