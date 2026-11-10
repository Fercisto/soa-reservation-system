<?php

namespace App\Saas;

use App\Models\Hotel;
use App\Models\Payment;
use App\Models\User;
use App\Payments\PaymentGateway;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Payments of a hotel to the platform: its subscription and credit packages.
 * They reuse the payments table and the Stripe Checkout flow of the reservations.
 */
class Billing
{
    public const PURPOSES = ['subscription', 'credits'];

    public static function startSubscription(Hotel $hotel, User $user, string $plan, PaymentGateway $gateway): Payment
    {
        $config = config("saas.plans.{$plan}");

        return self::startCheckout($hotel, $user, $gateway, [
            'purpose' => 'subscription',
            'metadata' => ['plan' => $plan],
            'amount' => $config['price'],
            'description' => "Plan {$config['name']} de {$hotel->name}, "
                .config('saas.period_days').' días',
        ]);
    }

    public static function startCreditPurchase(Hotel $hotel, User $user, string $package, PaymentGateway $gateway): Payment
    {
        $config = config("saas.credit_packages.{$package}");

        return self::startCheckout($hotel, $user, $gateway, [
            'purpose' => 'credits',
            'metadata' => ['package' => $package, 'credits' => $config['credits']],
            'amount' => $config['price'],
            'description' => "{$config['credits']} créditos para {$hotel->name} (paquete {$config['name']})",
        ]);
    }

    /**
     * Apply a paid platform payment once: activate the plan or add the credits.
     */
    public static function fulfill(Payment $payment): void
    {
        DB::transaction(function () use ($payment) {
            $payment = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            $metadata = $payment->metadata ?? [];

            if (isset($metadata['fulfilled_at']) || $payment->status !== 'paid') {
                return;
            }

            $hotel = $payment->hotel;

            if ($payment->purpose === 'subscription') {
                $metadata += self::activatePlan($hotel, $metadata['plan'], $payment);
            } else {
                $hotel->addCredits(
                    (int) $metadata['credits'],
                    'purchase',
                    "Compra de {$metadata['credits']} créditos",
                    $payment->user,
                    "payment:{$payment->id}"
                );
            }

            $payment->update(['metadata' => [...$metadata, 'fulfilled_at' => now()->toISOString()]]);
        });
    }

    /**
     * Renewing the same active plan extends it; a new plan (upgrade or downgrade) starts now.
     *
     * @return array{period_start: string, period_end: string}
     */
    private static function activatePlan(Hotel $hotel, string $plan, Payment $payment): array
    {
        $start = $hotel->plan === $plan && $hotel->plan_active ? $hotel->plan_expires_at : now();
        $end = $start->copy()->addDays(config('saas.period_days'));

        $hotel->update(['plan' => $plan, 'plan_expires_at' => $end]);

        $bonus = (int) config("saas.plans.{$plan}.monthly_credits");

        if ($bonus > 0) {
            $hotel->addCredits(
                $bonus,
                'bonus',
                "Créditos incluidos en el plan ".config("saas.plans.{$plan}.name"),
                $payment->user,
                "payment:{$payment->id}"
            );
        }

        return ['period_start' => $start->toISOString(), 'period_end' => $end->toISOString()];
    }

    private static function startCheckout(Hotel $hotel, User $user, PaymentGateway $gateway, array $attributes): Payment
    {
        $payment = Payment::create([
            ...$attributes,
            'user_id' => $user->id,
            'hotel_id' => $hotel->id,
            'customer_email' => $user->email,
            'currency' => config('services.payments.currency'),
            'method' => 'card',
            'status' => 'pending',
            'provider' => $gateway->name(),
        ]);

        $frontendUrl = config('services.payments.frontend_url');
        $payment->update([
            'success_url' => "{$frontendUrl}/panel?billing=success&payment_id={$payment->id}",
            'cancel_url' => "{$frontendUrl}/panel?billing=cancelled&payment_id={$payment->id}",
        ]);

        try {
            $result = $gateway->createCheckout($payment);
        } catch (Throwable $exception) {
            $payment->update(['status' => 'failed']);

            throw $exception;
        }

        $payment->update([
            'provider_reference' => $result->reference,
            'checkout_url' => $result->checkoutUrl,
        ]);

        return $payment;
    }
}
