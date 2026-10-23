<?php

namespace App\Invoicing;

use App\Models\Invoice;

interface InvoiceGateway
{
    public function name(): string;

    /**
     * Seal and stamp the CFDI with the SAT through the PAC.
     *
     * @throws InvoicingException
     */
    public function stamp(Invoice $invoice, string $xml): StampResult;

    /**
     * Ask the SAT to cancel a stamped CFDI.
     *
     * @throws InvoicingException
     */
    public function cancel(Invoice $invoice, string $reason): void;
}
