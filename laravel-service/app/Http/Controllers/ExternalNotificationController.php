<?php

namespace App\Http\Controllers;

use App\Models\ApiClient;
use App\Models\ExternalRecipient;
use App\Notifications\ExternalMessage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Generic notifications API for external systems: they send in-app messages to
 * their own recipients and read them back (e.g. to show a bell in their UI).
 */
class ExternalNotificationController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'recipient' => 'required|string|max:100',
            'title' => 'required|string|max:150',
            'message' => 'required|string|max:1000',
            'type' => ['sometimes', 'string', 'max:50', 'regex:/^[a-z0-9_.-]+$/'],
            'data' => 'sometimes|array',
        ]);

        $recipient = ExternalRecipient::firstOrCreate([
            'api_client_id' => $this->client($request)->id,
            'external_id' => $validated['recipient'],
        ]);

        $notification = new ExternalMessage(
            $validated['type'] ?? 'message',
            $validated['title'],
            $validated['message'],
            $validated['data'] ?? [],
        );
        $recipient->notify($notification);

        $stored = $recipient->notifications()->findOrFail($notification->id);

        return response()->json($this->format($stored, $recipient), 201);
    }

    public function index(Request $request)
    {
        $validated = $request->validate([
            'recipient' => 'required|string|max:100',
            'unread' => 'sometimes|boolean',
            'limit' => 'sometimes|integer|min:1|max:50',
        ]);

        $recipient = $this->client($request)->recipients()
            ->where('external_id', $validated['recipient'])
            ->first();

        if (! $recipient) {
            return response()->json(['unread_count' => 0, 'notifications' => []]);
        }

        $query = $request->boolean('unread')
            ? $recipient->unreadNotifications()
            : $recipient->notifications();

        return response()->json([
            'unread_count' => $recipient->unreadNotifications()->count(),
            'notifications' => $query
                ->limit($validated['limit'] ?? 20)
                ->get()
                ->map(fn (DatabaseNotification $notification) => $this->format($notification, $recipient)),
        ]);
    }

    public function show(Request $request, string $notification)
    {
        $notification = $this->find($request, $notification);

        return response()->json($this->format($notification, $notification->notifiable));
    }

    public function markAsRead(Request $request, string $notification)
    {
        $notification = $this->find($request, $notification);
        $notification->markAsRead();

        return response()->json($this->format($notification, $notification->notifiable));
    }

    public function markAllAsRead(Request $request)
    {
        $validated = $request->validate([
            'recipient' => 'required|string|max:100',
        ]);

        $recipient = $this->client($request)->recipients()
            ->where('external_id', $validated['recipient'])
            ->first();

        $updated = $recipient
            ? $recipient->unreadNotifications()->update(['read_at' => now()])
            : 0;

        return response()->json(['updated' => $updated]);
    }

    private function client(Request $request): ApiClient
    {
        return $request->attributes->get('api_client');
    }

    /**
     * Find a notification that belongs to one of the calling client's recipients.
     */
    private function find(Request $request, string $id): DatabaseNotification
    {
        $notification = DatabaseNotification::query()
            ->whereKey($id)
            ->whereHasMorph('notifiable', [ExternalRecipient::class], function (Builder $query) use ($request) {
                $query->where('api_client_id', $this->client($request)->id);
            })
            ->first();

        abort_unless($notification, 404, 'Notification not found.');

        return $notification;
    }

    private function format(DatabaseNotification $notification, ExternalRecipient $recipient): array
    {
        return [
            'id' => $notification->id,
            'recipient' => $recipient->external_id,
            'type' => $notification->type,
            'title' => $notification->data['title'] ?? '',
            'message' => $notification->data['message'] ?? '',
            'data' => (object) ($notification->data['data'] ?? []),
            'delivered' => true,
            'read_at' => $notification->read_at?->toISOString(),
            'created_at' => $notification->created_at->toISOString(),
        ];
    }
}
