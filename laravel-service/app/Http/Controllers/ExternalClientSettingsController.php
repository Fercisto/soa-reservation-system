<?php

namespace App\Http\Controllers;

use App\Models\ApiClient;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Stripe\Exception\ApiErrorException;
use Stripe\Exception\AuthenticationException;
use Stripe\StripeClient;

/**
 * Lets an external system manage its own settings: the Stripe secret key of its
 * own account and the URL that receives payment callbacks.
 */
class ExternalClientSettingsController extends Controller
{
    public function show(Request $request)
    {
        return response()->json($this->client($request)->toSettingsArray());
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'stripe_secret_key' => ['sometimes', 'nullable', 'string', 'max:255', 'regex:/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/'],
            'callback_url' => 'sometimes|nullable|url|max:255',
        ], [
            'stripe_secret_key.regex' => 'The Stripe secret key must start with sk_test_, sk_live_, rk_test_ or rk_live_.',
        ]);

        $client = $this->client($request);

        if (filled($validated['stripe_secret_key'] ?? null)) {
            $this->ensureStripeKeyWorks($validated['stripe_secret_key']);
            $client->stripe_secret = $validated['stripe_secret_key'];
        }

        if (array_key_exists('callback_url', $validated)) {
            $client->callback_url = $validated['callback_url'];
        }

        $client->save();

        return response()->json($client->toSettingsArray());
    }

    /**
     * Ask Stripe for the account balance, so a wrong key fails now and not on the first payment.
     */
    private function ensureStripeKeyWorks(string $secretKey): void
    {
        if (config('services.payments.driver') !== 'stripe') {
            return;
        }

        try {
            (new StripeClient(['api_key' => $secretKey]))->balance->retrieve();
        } catch (AuthenticationException) {
            throw ValidationException::withMessages([
                'stripe_secret_key' => 'Stripe rejected this secret key.',
            ]);
        } catch (ApiErrorException $exception) {
            throw ValidationException::withMessages([
                'stripe_secret_key' => 'The Stripe key could not be verified: '.$exception->getMessage(),
            ]);
        }
    }

    private function client(Request $request): ApiClient
    {
        return $request->attributes->get('api_client');
    }
}
