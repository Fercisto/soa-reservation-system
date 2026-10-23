<?php

namespace App\Notifications;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\User;
use Illuminate\Support\Facades\Notification;

/**
 * Decides who is notified about reservation events: the customer and the admins.
 */
class ReservationNotifier
{
    public static function confirmed(Reservation $reservation, Payment $payment): void
    {
        $notification = new ReservationConfirmed($reservation, $payment);

        $reservation->user->notify($notification);
        Notification::send(self::admins(), $notification);
    }

    public static function cancelled(Reservation $reservation, User $cancelledBy, ?Payment $refundedPayment): void
    {
        $notification = new ReservationCancelled($reservation, $cancelledBy, $refundedPayment);

        $reservation->user->notify($notification);
        Notification::send(self::admins()->except($cancelledBy->id), $notification);
    }

    public static function invoiced(Reservation $reservation, Invoice $invoice, User $requestedBy): void
    {
        $notification = new InvoiceIssued($reservation, $invoice);

        $reservation->user->notify($notification);
        Notification::send(self::admins()->except($requestedBy->id), $notification);
    }

    public static function invoiceCancelled(Reservation $reservation, Invoice $invoice, User $cancelledBy): void
    {
        $notification = new InvoiceCancelled($reservation, $invoice, $cancelledBy);

        if ($reservation->user_id !== $cancelledBy->id) {
            $reservation->user->notify($notification);
        }

        Notification::send(self::admins()->except($cancelledBy->id), $notification);
    }

    private static function admins()
    {
        return User::where('role', 'admin')->get();
    }
}
