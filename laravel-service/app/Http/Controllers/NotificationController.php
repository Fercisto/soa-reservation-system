<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'unread' => 'sometimes|boolean',
            'limit' => 'sometimes|integer|min:1|max:50',
        ]);

        $user = $request->user();
        $query = $request->boolean('unread')
            ? $user->unreadNotifications()
            : $user->notifications();

        return response()->json([
            'unread_count' => $user->unreadNotifications()->count(),
            'notifications' => $query
                ->limit($validated['limit'] ?? 20)
                ->get()
                ->map(fn (DatabaseNotification $notification) => $this->format($notification)),
        ]);
    }

    public function markAsRead(Request $request, string $notification)
    {
        $notification = $request->user()->notifications()->findOrFail($notification);
        $notification->markAsRead();

        return response()->json($this->format($notification));
    }

    public function markAllAsRead(Request $request)
    {
        $updated = $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['updated' => $updated]);
    }

    private function format(DatabaseNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'type' => $notification->type,
            'title' => $notification->data['title'] ?? '',
            'message' => $notification->data['message'] ?? '',
            'reservation_id' => $notification->data['reservation_id'] ?? null,
            'read_at' => $notification->read_at?->toISOString(),
            'created_at' => $notification->created_at->toISOString(),
        ];
    }
}
