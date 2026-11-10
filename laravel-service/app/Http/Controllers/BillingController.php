<?php

namespace App\Http\Controllers;

use App\Models\FeaturePass;
use App\Models\Payment;
use App\Payments\PaymentGateway;
use App\Saas\Billing;
use App\Saas\InsufficientCreditsException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Stripe\Exception\ApiErrorException;

/**
 * A hotel's account with the platform: subscription, credits and time passes.
 * Available even with an expired plan, so the hotel can renew.
 */
class BillingController extends Controller
{
    public function __construct(private readonly PaymentGateway $gateway)
    {
    }

    /**
     * Subscription and credit payments of the hotel, newest first.
     */
    public function payments(Request $request)
    {
        return response()->json(
            Payment::where('hotel_id', $request->user()->hotel_id)
                ->whereIn('purpose', Billing::PURPOSES)
                ->with('user:id,name')
                ->latest()
                ->limit(50)
                ->get()
        );
    }

    public function subscribe(Request $request)
    {
        $validated = $request->validate([
            'plan' => ['required', 'string', Rule::in(array_keys(config('saas.plans')))],
        ]);

        return $this->checkout(fn () => Billing::startSubscription(
            $request->user()->hotel,
            $request->user(),
            $validated['plan'],
            $this->gateway
        ));
    }

    public function buyCredits(Request $request)
    {
        $validated = $request->validate([
            'package' => ['required', 'string', Rule::in(array_keys(config('saas.credit_packages')))],
        ]);

        return $this->checkout(fn () => Billing::startCreditPurchase(
            $request->user()->hotel,
            $request->user(),
            $validated['package'],
            $this->gateway
        ));
    }

    /**
     * Called when Stripe sends the admin back to the panel.
     */
    public function verify(Request $request, Payment $payment)
    {
        abort_unless(
            $payment->hotel_id === $request->user()->hotel_id && in_array($payment->purpose, Billing::PURPOSES, true),
            404,
            'Payment not found.'
        );

        if ($payment->status === 'pending' && $payment->provider_reference) {
            try {
                $payment->applyGatewayResult($this->gateway->retrieve($payment));
            } catch (ApiErrorException $exception) {
                report($exception);

                return response()->json(['message' => 'Payment provider error: '.$exception->getMessage()], 502);
            }
        }

        return response()->json($payment->fresh());
    }

    /**
     * Credit ledger: every purchase, bonus and usage with the balance after it.
     */
    public function transactions(Request $request)
    {
        return response()->json(
            $request->user()->hotel->creditTransactions()
                ->with('user:id,name')
                ->latest('id')
                ->limit(100)
                ->get()
        );
    }

    public function passes(Request $request)
    {
        return response()->json(
            $request->user()->hotel->featurePasses()
                ->with('user:id,name')
                ->latest('id')
                ->limit(50)
                ->get()
        );
    }

    /**
     * Buy access to a module for some minutes, hours or days. Buying again while a pass
     * of the same module runs extends it from its end.
     */
    public function buyPass(Request $request)
    {
        $hotel = $request->user()->hotel;

        if (! $hotel->plan_active) {
            return response()->json([
                'message' => 'Your hotel subscription is not active. Renew it to use this module.',
            ], 402);
        }

        $validated = $request->validate([
            'feature' => ['required', 'string', Rule::in(array_keys(config('saas.passes')))],
            'unit' => ['required', 'string', Rule::in(FeaturePass::UNITS)],
            'quantity' => 'required|integer|min:1',
        ]);

        $limits = config("saas.pass_limits.{$validated['unit']}");
        $block = config('saas.minutes_block');

        if ($validated['quantity'] < $limits['min'] || $validated['quantity'] > $limits['max']
            || ($validated['unit'] === 'minutes' && $validated['quantity'] % $block !== 0)) {
            return response()->json([
                'message' => "The quantity of {$validated['unit']} must be between {$limits['min']} and {$limits['max']}"
                    .($validated['unit'] === 'minutes' ? " in blocks of {$block}." : '.'),
            ], 422);
        }

        $cost = FeaturePass::cost($validated['feature'], $validated['unit'], $validated['quantity']);
        $name = config("saas.passes.{$validated['feature']}.name");
        $units = ['minutes' => 'minutos', 'hours' => 'horas', 'days' => 'días'][$validated['unit']];

        try {
            $pass = DB::transaction(function () use ($hotel, $request, $validated, $cost, $name, $units) {
                $start = $hotel->passEndsAt($validated['feature']) ?? now();
                $end = $start->copy()->add($validated['unit'], $validated['quantity']);

                $pass = $hotel->featurePasses()->create([
                    ...$validated,
                    'user_id' => $request->user()->id,
                    'credits' => $cost,
                    'starts_at' => $start,
                    'expires_at' => $end,
                ]);

                $hotel->spendCredits(
                    $cost,
                    $validated['feature'],
                    "Pase de {$name}: {$validated['quantity']} {$units}",
                    $request->user(),
                    "pass:{$pass->id}"
                );

                return $pass;
            });
        } catch (InsufficientCreditsException $exception) {
            return $this->notEnoughCredits($exception);
        }

        return response()->json([
            'pass' => $pass,
            'hotel' => $hotel->fresh(),
            'active_passes' => $hotel->activePasses(),
        ], 201);
    }

    private function checkout(callable $start)
    {
        try {
            $payment = $start();
        } catch (ApiErrorException $exception) {
            report($exception);

            return response()->json(['message' => 'The payment could not be started: '.$exception->getMessage()], 502);
        }

        return response()->json($payment, 201);
    }

    private function notEnoughCredits(InsufficientCreditsException $exception)
    {
        return response()->json([
            'message' => "Not enough credits: {$exception->required} required, {$exception->balance} available. Buy a credit package.",
        ], 402);
    }
}
