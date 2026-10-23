<?php

namespace App\Invoicing;

/**
 * SAT catalogs accepted for the customer's fiscal data.
 */
final class TaxCatalog
{
    /**
     * c_RegimenFiscal
     */
    public const TAX_REGIMES = [
        '601', '603', '605', '606', '607', '608', '610', '611', '612', '614',
        '615', '616', '620', '621', '622', '623', '624', '625', '626',
    ];

    /**
     * c_UsoCFDI that make sense for a hotel stay.
     */
    public const CFDI_USES = ['G03', 'S01'];

    /**
     * c_FormaPago by payment method.
     */
    public const PAYMENT_FORMS = [
        'card' => '04',
        'cash' => '01',
    ];

    /**
     * 12 characters for companies, 13 for individuals.
     */
    public const RFC_PATTERN = '/^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/u';
}
