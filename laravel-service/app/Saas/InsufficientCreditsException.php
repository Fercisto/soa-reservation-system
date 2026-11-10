<?php

namespace App\Saas;

use RuntimeException;

class InsufficientCreditsException extends RuntimeException
{
    public function __construct(public readonly int $balance, public readonly int $required)
    {
        parent::__construct("Not enough credits: {$required} required, {$balance} available.");
    }
}
