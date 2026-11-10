<?php

namespace App\Notifications;

use App\Models\Campaign;
use App\Models\Hotel;
use Illuminate\Notifications\Notification;

/**
 * A hotel's campaign message, stored in the guest's in-app notifications.
 */
class GuestCampaign extends Notification
{
    public function __construct(
        public readonly Hotel $hotel,
        public readonly Campaign $campaign,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function databaseType(object $notifiable): string
    {
        return 'hotel_campaign';
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => "{$this->hotel->name}: {$this->campaign->title}",
            'message' => $this->campaign->message,
            'hotel_id' => $this->hotel->id,
            'hotel_slug' => $this->hotel->slug,
            'campaign_id' => $this->campaign->id,
        ];
    }
}
