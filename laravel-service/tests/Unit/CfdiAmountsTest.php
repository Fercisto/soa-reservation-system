<?php

namespace Tests\Unit;

use App\Invoicing\CfdiBuilder;
use PHPUnit\Framework\TestCase;

class CfdiAmountsTest extends TestCase
{
    public function test_subtotal_and_vat_add_up_to_the_amount_paid(): void
    {
        for ($cents = 1_00; $cents <= 5_000_00; $cents += 7) {
            $amounts = CfdiBuilder::amounts($cents / 100);

            $this->assertSame(
                $cents,
                (int) round((float) $amounts['subtotal'] * 100) + (int) round((float) $amounts['tax'] * 100),
                "Total {$cents}"
            );

            // The concept VAT is exactly 16% of its base, as the SAT recomputes it.
            $base = (float) $amounts['concept_base'];
            $decimals = strlen(explode('.', $amounts['concept_base'])[1]);
            $this->assertSame(number_format($base * 0.16, $decimals, '.', ''), $amounts['concept_tax']);
        }
    }

    public function test_round_amounts_use_two_decimals(): void
    {
        $this->assertSame([
            'subtotal' => '862.07',
            'tax' => '137.93',
            'concept_base' => '862.07',
            'concept_tax' => '137.93',
        ], CfdiBuilder::amounts('1000.00'));
    }
}
