<?php

namespace App\Notifications;

use App\Models\Reservation;
use App\Models\User;
use Illuminate\Notifications\Notification;

/**
 * In-app notification about a reservation, stored in the notifications table.
 * The message depends on whether the recipient is the customer or an admin.
 */
abstract class ReservationNotification extends Notification
{
    public function __construct(public readonly Reservation $reservation)
    {
        $this->reservation->loadMissing(['room', 'user']);
    }

    abstract public function databaseType(object $notifiable): string;

    abstract protected function title(User $notifiable): string;

    abstract protected function message(User $notifiable): string;

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->title($notifiable),
            'message' => $this->message($notifiable),
            'reservation_id' => $this->reservation->id,
            'room_number' => $this->reservation->room->number,
            'check_in' => $this->reservation->check_in->toDateString(),
            'check_out' => $this->reservation->check_out->toDateString(),
            'customer' => $this->reservation->user->name,
        ];
    }

    protected function stay(): string
    {
        return "la habitación {$this->reservation->room->number} "
            ."del {$this->reservation->check_in->toDateString()} "
            ."al {$this->reservation->check_out->toDateString()}";
    }

    protected function money(string|float $amount): string
    {
        return '$'.number_format((float) $amount, 2);
    }
}
