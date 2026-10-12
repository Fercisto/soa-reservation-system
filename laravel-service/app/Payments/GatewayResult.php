<?php

namespace App\Payments;

final class GatewayResult
{
    public function __construct(
        public readonly string $reference,
        public readonly string $status,
        public readonly ?string $checkoutUrl = null,
        public readonly ?string $paymentIntent = null,
    ) {
    }
}
