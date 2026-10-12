<?php

namespace App\Payments;

use App\Models\Payment;
use Stripe\Checkout\Session;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Exception\UnexpectedValueException;
use Stripe\StripeClient;
use Stripe\Webhook;

class StripeGateway implements PaymentGateway
{
    private const WEBHOOK_EVENTS = [
        'checkout.session.completed',
        'checkout.session.async_payment_succeeded',
        'checkout.session.async_payment_failed',
        'checkout.session.expired',
    ];

    public function __construct(
        private readonly StripeClient $stripe,
        private readonly ?string $webhookSecret,
        private readonly string $frontendUrl,
    ) {
    }

    public function name(): string
    {
        return 'stripe';
    }

    public function createCheckout(Payment $payment): GatewayResult
    {
        $reservation = $payment->reservation->loadMissing(['room', 'user']);

        $session = $this->stripe->checkout->sessions->create([
            'mode' => 'payment',
            'customer_email' => $reservation->user->email,
            'client_reference_id' => (string) $payment->id,
            'metadata' => [
                'payment_id' => (string) $payment->id,
                'reservation_id' => (string) $reservation->id,
            ],
            'line_items' => [[
                'quantity' => 1,
                'price_data' => [
                    'currency' => $payment->currency,
                    'unit_amount' => (int) round((float) $payment->amount * 100),
                    'product_data' => [
                        'name' => "Habitación {$reservation->room->number} ({$reservation->room->type})",
                        'description' => "Del {$reservation->check_in->toDateString()} al {$reservation->check_out->toDateString()}",
                    ],
                ],
            ]],
            // The checkout closes when the reservation hold ends, so nobody pays for released dates.
            'expires_at' => $reservation->expires_at->getTimestamp(),
            'success_url' => "{$this->frontendUrl}/?payment=success&payment_id={$payment->id}",
            'cancel_url' => "{$this->frontendUrl}/?payment=cancelled&payment_id={$payment->id}",
        ]);

        return $this->resultFromSession($session);
    }

    public function retrieve(Payment $payment): GatewayResult
    {
        return $this->resultFromSession(
            $this->stripe->checkout->sessions->retrieve($payment->provider_reference)
        );
    }

    public function refund(Payment $payment): void
    {
        $paymentIntent = $payment->provider_payment_intent
            ?? $this->retrieve($payment)->paymentIntent;

        $this->stripe->refunds->create(['payment_intent' => $paymentIntent]);
    }

    public function cancelCheckout(Payment $payment): void
    {
        $this->stripe->checkout->sessions->expire($payment->provider_reference);
    }

    public function parseWebhook(string $payload, ?string $signature): ?GatewayResult
    {
        if (! $this->webhookSecret) {
            throw new InvalidWebhookException('Stripe webhook secret is not configured.');
        }

        try {
            $event = Webhook::constructEvent($payload, $signature ?? '', $this->webhookSecret);
        } catch (SignatureVerificationException|UnexpectedValueException $exception) {
            throw new InvalidWebhookException($exception->getMessage());
        }

        if (! in_array($event->type, self::WEBHOOK_EVENTS, true)) {
            return null;
        }

        $result = $this->resultFromSession($event->data->object);

        if ($event->type === 'checkout.session.async_payment_failed') {
            return new GatewayResult($result->reference, 'failed', null, $result->paymentIntent);
        }

        return $result;
    }

    private function resultFromSession(Session $session): GatewayResult
    {
        $status = match (true) {
            $session->payment_status === 'paid' => 'paid',
            $session->status === 'expired' => 'failed',
            default => 'pending',
        };

        $paymentIntent = is_string($session->payment_intent)
            ? $session->payment_intent
            : $session->payment_intent?->id;

        return new GatewayResult($session->id, $status, $session->url, $paymentIntent);
    }
}
