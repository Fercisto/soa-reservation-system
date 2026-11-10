<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Admin routes of a hotel (tenant). Usage:
 *   hotel                    admin of a hotel, even with an expired plan (billing)
 *   hotel:active             and an active subscription
 *   hotel:feature,overview   and a plan that includes the module
 *   hotel:pass,analytics     and a running time pass for the module
 */
class EnsureHotelAccess
{
    public function handle(Request $request, Closure $next, ?string $check = null, ?string $module = null): Response
    {
        $user = $request->user();
        $hotel = $user?->role === 'admin' ? $user->hotel : null;

        if (! $hotel) {
            return $this->deny(403, 'Only hotel administrators can perform this action.');
        }

        if ($check === null) {
            return $next($request);
        }

        if (! $hotel->plan_active) {
            return $this->deny(402, 'Your hotel subscription is not active. Renew it to use this module.');
        }

        if ($check === 'feature' && ! $hotel->hasFeature($module)) {
            return $this->deny(403, 'Your plan does not include this module. Upgrade your plan to use it.');
        }

        if ($check === 'pass' && ! $hotel->activePass($module)) {
            return $this->deny(402, 'This module needs an active time pass. Buy one with credits.');
        }

        return $next($request);
    }

    private function deny(int $status, string $message): Response
    {
        return response()->json(['message' => $message], $status);
    }
}
