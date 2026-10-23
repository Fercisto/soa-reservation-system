<?php

namespace App\Invoicing;

use RuntimeException;

/**
 * The PAC rejected the request or could not be reached. The message is safe to show to the customer.
 */
class InvoicingException extends RuntimeException
{
}
