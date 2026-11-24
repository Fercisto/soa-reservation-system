<?php

namespace App\Messaging;

use App\Models\ServiceLog;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * Processes the messages of each queue. Kept apart from the consumer command so it can be
 * tested without a broker.
 */
class MessageHandler
{
    public function handle(string $queue, array $payload): void
    {
        match ($queue) {
            'service_logs' => $this->storeServiceLog($payload),
            'notifications' => $this->deliverNotification($payload),
            default => throw new InvalidArgumentException("Unknown queue {$queue}."),
        };
    }

    private function storeServiceLog(array $payload): void
    {
        if (empty($payload['service']) || empty($payload['operation'])) {
            throw new InvalidArgumentException('A service log needs a service and an operation.');
        }

        ServiceLog::create([
            'service' => Str::limit($payload['service'], 40, ''),
            'operation' => Str::limit($payload['operation'], 100, ''),
            'kind' => $payload['kind'] ?? 'query',
            'source' => $payload['source'] ?? 'gateway',
            'user_id' => $payload['user_id'] ?? null,
            'actor' => isset($payload['actor']) ? Str::limit($payload['actor'], 255, '') : null,
            'role' => $payload['role'] ?? null,
            'hotel_id' => $payload['hotel_id'] ?? null,
            'success' => (bool) ($payload['success'] ?? true),
            'status_code' => $payload['status_code'] ?? null,
            'error' => isset($payload['error']) ? Str::limit($payload['error'], 255) : null,
            'duration_ms' => max(0, (int) ($payload['duration_ms'] ?? 0)),
            'ip' => $payload['ip'] ?? null,
            'occurred_at' => $payload['occurred_at'] ?? now(),
        ]);
    }

    /**
     * Stores the notification for its recipients and records the delivery in the log.
     */
    private function deliverNotification(array $payload): void
    {
        $startedAt = microtime(true);
        $notification = unserialize(base64_decode($payload['notification'] ?? ''));
        $type = $payload['notifiable_type'] ?? null;

        if (! is_object($notification) || ! is_string($type) || ! class_exists($type)) {
            throw new InvalidArgumentException('Invalid notification message.');
        }

        $notifiables = $type::query()->findMany($payload['notifiable_ids'] ?? []);

        Notification::sendNow($notifiables, $notification);

        ServiceLog::create([
            'service' => 'Notificaciones',
            'operation' => class_basename($notification),
            'kind' => 'worker',
            'source' => 'worker',
            'actor' => $notifiables->count().' '.($notifiables->count() === 1 ? 'destinatario' : 'destinatarios'),
            'hotel_id' => $this->hotelOf($notification),
            'success' => true,
            'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            'occurred_at' => now(),
        ]);
    }

    private function hotelOf(object $notification): ?int
    {
        return $notification->reservation->hotel_id
            ?? $notification->hotel->id
            ?? null;
    }
}
