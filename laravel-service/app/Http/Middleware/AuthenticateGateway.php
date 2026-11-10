<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Internal routes only the NestJS gateway may call, with the shared X-Gateway-Secret header.
 */
class AuthenticateGateway
{
    public function handle(Request $request, Closure $next): Response
    {
        $secret = (string) config('services.gateway.secret');

        if ($secret === '') {
            return response()->json(['message' => 'The gateway secret is not configured.'], 503);
        }

        if (! hash_equals($secret, (string) $request->header('X-Gateway-Secret'))) {
            return response()->json(['message' => 'Invalid gateway secret.'], 401);
        }

        return $next($request);
    }
}
