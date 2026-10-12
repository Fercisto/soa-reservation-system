<?php

namespace App\Payments;

use App\Models\Payment;
use Illuminate\Support\Str;

/**
 * Offline gateway used by the test suite (PAYMENT_DRIVER=fake).
 * Every checkout is approved as soon as it is verified.
 */
class FakeGateway implements PaymentGateway
{
    public function __construct(private readonly string $frontendUrl)
    {
    }

    public function name(): string
    {
        return 'fake';
    }

    public function createCheckout(Payment $payment): GatewayResult
    {
        return new GatewayResult(
            'fake_'.Str::uuid(),
            'pending',
            "{$this->frontendUrl}/?payment=success&payment_id={$payment->id}"
        );
    }

    public function retrieve(Payment $payment): GatewayResult
    {
        return new GatewayResult($payment->provider_reference, 'paid', null, 'fake_pi_'.$payment->id);
    }

    public function refund(Payment $payment): void
    {
        //
    }

    public function cancelCheckout(Payment $payment): void
    {
        //
    }

    public function parseWebhook(string $payload, ?string $signature): ?GatewayResult
    {
        $data = json_decode($payload, true);

        if (! isset($data['reference'], $data['status'])) {
            throw new InvalidWebhookException('Invalid fake webhook payload.');
        }

        return new GatewayResult($data['reference'], $data['status']);
    }
}
