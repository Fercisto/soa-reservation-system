<?php

namespace App\Invoicing;

final class StampResult
{
    public function __construct(
        public readonly string $uuid,
        public readonly string $xml,
        // Base64 image of the SAT verification QR code.
        public readonly ?string $qrCode = null,
    ) {
    }
}
