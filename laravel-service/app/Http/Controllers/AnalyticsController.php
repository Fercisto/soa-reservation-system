<?php

namespace App\Http\Controllers;

use App\Saas\HotelStats;
use Illuminate\Http\Request;

/**
 * Advanced analytics, available while the hotel has a running time pass.
 */
class AnalyticsController extends Controller
{
    public function __invoke(Request $request)
    {
        $hotel = $request->user()->hotel;

        return response()->json([
            ...(new HotelStats($hotel))->analytics(),
            'pass_expires_at' => $hotel->passEndsAt('analytics')?->toISOString(),
        ]);
    }
}
