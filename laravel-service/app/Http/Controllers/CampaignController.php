<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\Hotel;
use App\Models\User;
use App\Notifications\GuestCampaign;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;

/**
 * Messages from a hotel to its guests, delivered to their in-app notifications.
 * Available while the hotel has a running time pass.
 */
class CampaignController extends Controller
{
    public function index(Request $request)
    {
        $hotel = $request->user()->hotel;

        return response()->json([
            'audiences' => collect(Campaign::AUDIENCES)
                ->mapWithKeys(fn (string $audience) => [$audience => $this->recipients($hotel, $audience)->count()]),
            'campaigns' => Campaign::where('hotel_id', $hotel->id)
                ->with('user:id,name')
                ->latest('id')
                ->limit(50)
                ->get(),
            'pass_expires_at' => $hotel->passEndsAt('campaigns')?->toISOString(),
        ]);
    }

    public function store(Request $request)
    {
        $hotel = $request->user()->hotel;

        $validated = $request->validate([
            'audience' => ['required', 'string', Rule::in(Campaign::AUDIENCES)],
            'title' => 'required|string|max:120',
            'message' => 'required|string|max:1000',
        ]);

        $recipients = $this->recipients($hotel, $validated['audience']);

        if ($recipients->isEmpty()) {
            return response()->json(['message' => 'There are no guests in this audience yet.'], 422);
        }

        $campaign = Campaign::forceCreate([
            ...$validated,
            'hotel_id' => $hotel->id,
            'user_id' => $request->user()->id,
            'recipients' => $recipients->count(),
        ]);

        Notification::send($recipients, new GuestCampaign($hotel, $campaign));

        return response()->json($campaign->load('user:id,name'), 201);
    }

    /**
     * Guests with a confirmed stay at the hotel: ended (past), ahead (upcoming) or any (all).
     */
    private function recipients(Hotel $hotel, string $audience)
    {
        $today = now(config('services.hotel.timezone'))->toDateString();

        return User::query()
            ->where('role', 'customer')
            ->whereHas('reservations', function ($query) use ($hotel, $audience, $today) {
                $query->where('hotel_id', $hotel->id)
                    ->where('status', 'confirmed')
                    ->when($audience === 'past', fn ($query) => $query->where('check_out', '<=', $today))
                    ->when($audience === 'upcoming', fn ($query) => $query->where('check_out', '>', $today));
            })
            ->get();
    }
}
