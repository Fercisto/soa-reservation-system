<?php

namespace App\Messaging;

use Illuminate\Notifications\Notification as BaseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;
use Throwable;

/**
 * Sends in-app notifications through RabbitMQ: the request only publishes a message and the
 * consumer (php artisan hospedia:consume) stores the notifications. Without the broker,
 * or if it cannot be reached, they are stored right away so nobody misses them.
 */
class NotificationBus
{
    public static function send(mixed $notifiables, BaseNotification $notification): void
    {
        $notifiables = Collection::wrap($notifiables)->filter()->values();

        if ($notifiables->isEmpty()) {
            return;
        }

        if (! RabbitMq::enabled()) {
            Notification::sendNow($notifiables, $notification);

            return;
        }

        try {
            app(RabbitMq::class)->publish('notifications', [
                'notification' => base64_encode(serialize($notification)),
                'notifiable_type' => $notifiables->first()::class,
                'notifiable_ids' => $notifiables->map->getKey()->all(),
                'queued_at' => now()->toISOString(),
            ]);
        } catch (Throwable $exception) {
            report($exception);
            Notification::sendNow($notifiables, $notification);
        }
    }
}
