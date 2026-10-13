<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

/**
 * Free-form in-app notification sent by an external system to one of its recipients.
 */
class ExternalMessage extends Notification
{
    public function __construct(
        public readonly string $type,
        public readonly string $title,
        public readonly string $message,
        public readonly array $data = [],
    ) {
        // A known id lets the API confirm exactly which notification was stored.
        $this->id = (string) Str::uuid();
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return $this->type;
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->title,
            'message' => $this->message,
            'data' => $this->data,
        ];
    }
}
