<?php

namespace App\Http\Controllers;

use App\Models\Hotel;
use App\Models\Reservation;
use App\Models\User;
use App\Payments\PaymentGateway;
use App\Saas\Billing;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Throwable;

class HotelController extends Controller
{
    /**
     * Platform catalog for the home page: plans, credit packages and special modules.
     */
    public function plans()
    {
        return response()->json([
            'period_days' => config('saas.period_days'),
            'plans' => collect(config('saas.plans'))
                ->map(fn (array $plan, string $id) => ['id' => $id, ...$plan])
                ->values(),
            'credit_packages' => collect(config('saas.credit_packages'))
                ->map(fn (array $package, string $id) => ['id' => $id, ...$package])
                ->values(),
            'credit_features' => collect(config('saas.credit_features'))
                ->map(fn (array $feature, string $id) => ['id' => $id, ...$feature])
                ->values(),
            'passes' => collect(config('saas.passes'))
                ->map(fn (array $pass, string $id) => ['id' => $id, ...$pass])
                ->values(),
            'minutes_block' => config('saas.minutes_block'),
            'pass_limits' => config('saas.pass_limits'),
        ]);
    }

    /**
     * Hotels guests can book: only those with an active subscription.
     */
    public function index()
    {
        return response()->json(
            Hotel::active()
                ->withCount(['rooms' => fn ($query) => $query->where('status', 'available')])
                ->withMin(['rooms' => fn ($query) => $query->where('status', 'available')], 'price')
                ->orderBy('name')
                ->get()
                ->map(fn (Hotel $hotel) => $this->publicHotel($hotel))
        );
    }

    public function show(string $slug)
    {
        $hotel = Hotel::active()->where('slug', $slug)->firstOrFail();

        return response()->json($this->publicHotel($hotel));
    }

    public function availableRooms(Request $request, string $slug)
    {
        $hotel = Hotel::active()->where('slug', $slug)->firstOrFail();

        $validated = $request->validate([
            'check_in' => 'nullable|required_with:check_out|date_format:Y-m-d',
            'check_out' => 'nullable|required_with:check_in|date_format:Y-m-d|after:check_in',
        ]);

        $checkIn = $validated['check_in'] ?? null;
        $checkOut = $validated['check_out'] ?? null;

        Reservation::expireStale();

        return response()->json(
            $hotel->rooms()
                ->where('status', 'available')
                ->when($checkIn && $checkOut, function ($query) use ($checkIn, $checkOut) {
                    $query->whereDoesntHave('reservations', function ($query) use ($checkIn, $checkOut) {
                        $query->whereIn('status', Reservation::ACTIVE_STATUSES)
                            ->where('check_in', '<', $checkOut)
                            ->where('check_out', '>', $checkIn);
                    });
                })
                ->orderBy('number')
                ->get()
        );
    }

    /**
     * Sign up a hotel and its first admin, then start the checkout of the chosen plan.
     * The hotel exists even if the payment is not completed; it can pay later from its panel.
     */
    public function register(Request $request, PaymentGateway $gateway)
    {
        $validated = $request->validate([
            'hotel_name' => 'required|string|max:120',
            'city' => 'required|string|max:120',
            'description' => 'nullable|string|max:500',
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'plan' => ['required', 'string', Rule::in(array_keys(config('saas.plans')))],
        ]);

        [$hotel, $user] = DB::transaction(function () use ($validated) {
            $hotel = Hotel::create([
                'name' => $validated['hotel_name'],
                'slug' => Hotel::uniqueSlug($validated['hotel_name']),
                'city' => $validated['city'],
                'description' => $validated['description'] ?? null,
            ]);

            $user = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role' => 'admin',
                'hotel_id' => $hotel->id,
            ]);

            return [$hotel, $user];
        });

        $payment = null;
        $paymentError = null;

        try {
            $payment = Billing::startSubscription($hotel, $user, $validated['plan'], $gateway);
        } catch (Throwable $exception) {
            report($exception);
            $paymentError = 'The payment could not be started: '.$exception->getMessage();
        }

        return response()->json([
            'message' => 'Hotel registered successfully',
            'token' => $user->createToken('auth-token')->plainTextToken,
            'user' => $user->load('hotel'),
            'payment' => $payment,
            'payment_error' => $paymentError,
        ], 201);
    }

    public function mine(Request $request)
    {
        return response()->json($this->adminHotel($request->user()->hotel));
    }

    public function update(Request $request)
    {
        $hotel = $request->user()->hotel;

        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'city' => 'required|string|max:120',
            'description' => 'nullable|string|max:500',
            // Omit it to keep the current key; an empty value removes it.
            'restaurant_api_key' => 'sometimes|nullable|string|max:255',
        ]);

        if (array_key_exists('restaurant_api_key', $validated)) {
            $validated['restaurant_api_key'] = $validated['restaurant_api_key'] ?: null;
        }

        $hotel->update($validated);

        return response()->json($this->adminHotel($hotel->fresh()));
    }

    /**
     * The hotel's API key for the restaurant system, for the NestJS gateway only. The same key
     * opens its menu (Gold) and its staff (Silver and Gold) in the restaurant services.
     */
    public function restaurantCredentials(string $slug)
    {
        $hotel = Hotel::where('slug', $slug)->firstOrFail();
        $usesServices = $hotel->hasFeature('restaurant') || $hotel->hasFeature('staff');

        return response()->json([
            'enabled' => $hotel->hasFeature('restaurant') && $hotel->restaurant_api_key !== null,
            'api_key' => $usesServices ? $hotel->restaurant_api_key : null,
            'features' => $hotel->features,
        ]);
    }

    private function publicHotel(Hotel $hotel): array
    {
        return [
            'id' => $hotel->id,
            'name' => $hotel->name,
            'slug' => $hotel->slug,
            'city' => $hotel->city,
            'description' => $hotel->description,
            'rooms_count' => $hotel->rooms_count ?? $hotel->rooms()->where('status', 'available')->count(),
            'min_price' => isset($hotel->rooms_min_price) ? (float) $hotel->rooms_min_price : null,
            'has_restaurant' => $hotel->hasFeature('restaurant') && $hotel->restaurant_api_key !== null,
        ];
    }

    private function adminHotel(Hotel $hotel): array
    {
        return [
            ...$hotel->toArray(),
            'restaurant_configured' => $hotel->restaurant_api_key !== null,
            'active_passes' => $hotel->activePasses(),
            'rooms_used' => $hotel->rooms()->count(),
        ];
    }
}
