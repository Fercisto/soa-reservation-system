<?php

namespace App\Invoicing;

use App\Models\Invoice;
use Illuminate\Support\Str;

/**
 * Offline gateway used by the test suite (INVOICE_DRIVER=fake).
 * Every CFDI is stamped with a random UUID.
 */
class FakeInvoiceGateway implements InvoiceGateway
{
    public function name(): string
    {
        return 'fake';
    }

    public function stamp(Invoice $invoice, string $xml): StampResult
    {
        return new StampResult(strtoupper((string) Str::uuid()), $xml, null);
    }

    public function cancel(Invoice $invoice, string $reason): void
    {
        //
    }
}
