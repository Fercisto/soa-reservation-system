<?php

namespace App\Payments;

use App\Models\Payment;

interface PaymentGateway
{
    public function name(): string;

    /**
     * Start a checkout for the payment and return the provider reference and checkout URL.
     */
    public function createCheckout(Payment $payment): GatewayResult;

    /**
     * Ask the provider for the current status of the payment.
     */
    public function retrieve(Payment $payment): GatewayResult;

    public function refund(Payment $payment): void;

    /**
     * Close an unpaid checkout so it can no longer be paid.
     */
    public function cancelCheckout(Payment $payment): void;

    /**
     * Translate a provider webhook into a result, or null when the event is not relevant.
     *
     * @throws InvalidWebhookException
     */
    public function parseWebhook(string $payload, ?string $signature): ?GatewayResult;
}
