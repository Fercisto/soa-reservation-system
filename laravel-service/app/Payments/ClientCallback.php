<?php

namespace App\Payments;

use App\Models\Payment;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Tells an external system that one of its payments changed status.
 *
 * The JSON body is signed with HMAC-SHA256 using the client's callback secret and
 * sent in the X-Signature header, so the receiver can verify it came from this service.
 */
class ClientCallback
{
    private const EVENTS = ['paid', 'failed', 'refunded'];

    public static function send(Payment $payment): void
    {
        $client = $payment->apiClient;

        if (! $client?->callback_url || ! in_array($payment->status, self::EVENTS, true)) {
            return;
        }

        $body = json_encode([
            'event' => "payment.{$payment->status}",
            'data' => $payment->toExternalArray(),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        try {
            Http::timeout(5)
                ->withHeaders(['X-Signature' => hash_hmac('sha256', $body, $client->callback_secret)])
                ->withBody($body, 'application/json')
                ->post($client->callback_url);
        } catch (Throwable $exception) {
            // The client can still poll GET /v1/payments/{id}; a failed callback must not break the payment.
            report($exception);
        }
    }
}
