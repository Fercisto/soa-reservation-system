<?php

namespace App\Invoicing;

use App\Models\Invoice;
use DOMDocument;
use DOMElement;

/**
 * Builds the unsigned CFDI 4.0 XML of a hotel stay. The PAC adds the seal and the stamp.
 */
class CfdiBuilder
{
    private const NAMESPACE = 'http://www.sat.gob.mx/cfd/4';

    private const VAT_RATE = 0.16;

    public function __construct(private readonly array $emitter)
    {
    }

    /**
     * Split a total that already includes 16% VAT into subtotal and tax, so that
     * subtotal + tax equals the amount paid. When no two-decimal split adds up,
     * the concept carries six decimals (allowed by the SAT) and the totals are rounded.
     *
     * @return array{subtotal: string, tax: string, concept_base: string, concept_tax: string}
     */
    public static function amounts(string|float $total): array
    {
        $totalCents = (int) round((float) $total * 100);
        $baseCents = (int) round($totalCents / (1 + self::VAT_RATE));

        foreach ([0, -1, 1, -2, 2] as $offset) {
            $subtotal = $baseCents + $offset;
            $tax = (int) round($subtotal * self::VAT_RATE);

            if ($subtotal + $tax === $totalCents) {
                return [
                    'subtotal' => self::decimal($subtotal, 100),
                    'tax' => self::decimal($tax, 100),
                    'concept_base' => self::decimal($subtotal, 100),
                    'concept_tax' => self::decimal($tax, 100),
                ];
            }
        }

        $totalMicros = $totalCents * 10_000;
        $baseMicros = (int) round($totalMicros / (1 + self::VAT_RATE));

        for ($step = 0; $step <= 40; $step++) {
            $subtotal = $baseMicros + ($step % 2 === 0 ? $step / 2 : -($step + 1) / 2);
            $tax = (int) round($subtotal * self::VAT_RATE);
            $subtotalCents = (int) round($subtotal / 10_000);
            $taxCents = (int) round($tax / 10_000);

            if ($subtotalCents + $taxCents === $totalCents) {
                return [
                    'subtotal' => self::decimal($subtotalCents, 100),
                    'tax' => self::decimal($taxCents, 100),
                    'concept_base' => self::decimal($subtotal, 1_000_000),
                    'concept_tax' => self::decimal($tax, 1_000_000),
                ];
            }
        }

        throw new InvoicingException("The amount {$total} cannot be split into subtotal and VAT.");
    }

    public function build(Invoice $invoice, string $description, string $issuedAt): string
    {
        $amounts = self::amounts($invoice->total);

        $document = new DOMDocument('1.0', 'UTF-8');
        $receipt = $this->element($document, $document, 'Comprobante', [
            'Version' => '4.0',
            'Serie' => $invoice->series,
            'Folio' => $invoice->folio,
            'Fecha' => $issuedAt,
            'FormaPago' => $invoice->payment_form,
            'SubTotal' => $amounts['subtotal'],
            'Moneda' => 'MXN',
            'Total' => self::decimal((int) round((float) $invoice->total * 100), 100),
            'TipoDeComprobante' => 'I',
            'Exportacion' => '01',
            'MetodoPago' => 'PUE',
            'LugarExpedicion' => $this->emitter['postal_code'],
        ]);
        $receipt->setAttributeNS(
            'http://www.w3.org/2001/XMLSchema-instance',
            'xsi:schemaLocation',
            self::NAMESPACE.' http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd'
        );

        $this->element($document, $receipt, 'Emisor', [
            'Rfc' => $this->emitter['rfc'],
            'Nombre' => $this->emitter['name'],
            'RegimenFiscal' => $this->emitter['tax_regime'],
        ]);

        $this->element($document, $receipt, 'Receptor', [
            'Rfc' => $invoice->rfc,
            'Nombre' => $invoice->name,
            'DomicilioFiscalReceptor' => $invoice->postal_code,
            'RegimenFiscalReceptor' => $invoice->tax_regime,
            'UsoCFDI' => $invoice->cfdi_use,
        ]);

        $concepts = $this->element($document, $receipt, 'Conceptos');
        $concept = $this->element($document, $concepts, 'Concepto', [
            'ClaveProdServ' => $this->emitter['product_code'],
            'Cantidad' => '1',
            'ClaveUnidad' => 'E48',
            'Unidad' => 'Servicio',
            'Descripcion' => $description,
            'ValorUnitario' => $amounts['concept_base'],
            'Importe' => $amounts['concept_base'],
            'ObjetoImp' => '02',
        ]);
        $conceptTaxes = $this->element($document, $this->element($document, $concept, 'Impuestos'), 'Traslados');
        $this->element($document, $conceptTaxes, 'Traslado', [
            'Base' => $amounts['concept_base'],
            'Impuesto' => '002',
            'TipoFactor' => 'Tasa',
            'TasaOCuota' => '0.160000',
            'Importe' => $amounts['concept_tax'],
        ]);

        $taxes = $this->element($document, $receipt, 'Impuestos', [
            'TotalImpuestosTrasladados' => $amounts['tax'],
        ]);
        $this->element($document, $this->element($document, $taxes, 'Traslados'), 'Traslado', [
            'Base' => $amounts['subtotal'],
            'Impuesto' => '002',
            'TipoFactor' => 'Tasa',
            'TasaOCuota' => '0.160000',
            'Importe' => $amounts['tax'],
        ]);

        return $document->saveXML();
    }

    private function element(DOMDocument $document, DOMDocument|DOMElement $parent, string $name, array $attributes = []): DOMElement
    {
        $element = $document->createElementNS(self::NAMESPACE, "cfdi:{$name}");

        foreach ($attributes as $attribute => $value) {
            $element->setAttribute($attribute, (string) $value);
        }

        $parent->appendChild($element);

        return $element;
    }

    private static function decimal(int $value, int $scale): string
    {
        $decimals = (int) log10($scale);

        return number_format($value / $scale, $decimals, '.', '');
    }
}
