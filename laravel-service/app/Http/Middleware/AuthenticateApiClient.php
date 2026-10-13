<?php

namespace App\Http\Middleware;

use App\Models\ApiClient;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Authenticates external systems by the X-Api-Key header.
 */
class AuthenticateApiClient
{
    public function handle(Request $request, Closure $next): Response
    {
        $client = ApiClient::findActiveByKey($request->header('X-Api-Key'));

        if (! $client) {
            return response()->json(['message' => 'Invalid or missing API key.'], 401);
        }

        $request->attributes->set('api_client', $client);

        return $next($request);
    }
}
