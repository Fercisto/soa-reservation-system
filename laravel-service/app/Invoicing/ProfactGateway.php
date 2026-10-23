<?php

namespace App\Invoicing;

use App\Models\Invoice;
use SoapClient;
use SoapFault;

/**
 * Profact PAC (timbracfdi33.mx) SOAP service. Profact seals the CFDI with the
 * emitter's CSD registered in its platform and stamps it with the SAT.
 */
class ProfactGateway implements InvoiceGateway
{
    /**
     * Cancellation codes that mean the SAT accepted or already has the cancellation.
     */
    private const CANCELLED_CODES = ['0', '202', '330279', '330280'];

    /**
     * A CFDI stamped minutes ago that the SAT does not list yet.
     */
    private const NOT_YET_AT_SAT_CODE = '330203';

    private ?SoapClient $client = null;

    public function __construct(
        private readonly string $wsdl,
        private readonly string $user,
        private readonly string $emitterRfc,
        private readonly bool $verifySsl = true,
    ) {
    }

    public function name(): string
    {
        return 'profact';
    }

    public function stamp(Invoice $invoice, string $xml): StampResult
    {
        $result = $this->call('TimbraCFDI', [
            'usuarioIntegrador' => $this->user,
            'xmlComprobanteBase64' => base64_encode($xml),
            // Must be unique per request, so a failed attempt can be retried.
            'idComprobante' => "hotel-{$invoice->id}-".now()->timestamp,
        ]);

        $stampedXml = (string) ($result[3] ?? '');

        if ($stampedXml === '' || ! preg_match('/UUID="([0-9A-Fa-f-]{36})"/', $stampedXml, $match)) {
            throw new InvoicingException($this->errorMessage($result));
        }

        $qrCode = isset($result[4]) && $result[4] !== '' ? base64_encode($result[4]) : null;

        return new StampResult(strtoupper($match[1]), $stampedXml, $qrCode);
    }

    public function cancel(Invoice $invoice, string $reason): void
    {
        $result = $this->call('CancelaCFDI40', [
            'usuarioIntegrador' => $this->user,
            'rfcEmisor' => $this->emitterRfc,
            'folioUUID' => $invoice->uuid,
            'motivoCancelacion' => $reason,
            'folioUUIDSustitucion' => '',
        ]);

        $code = (string) ($result[1] ?? '');

        if ($code === self::NOT_YET_AT_SAT_CODE) {
            throw new InvoicingException('The SAT has not registered this invoice yet. Try again in a few minutes.');
        }

        if (! in_array($code, self::CANCELLED_CODES, true)) {
            throw new InvoicingException($this->errorMessage($result));
        }
    }

    /**
     * Profact answers every operation with a positional array:
     * [type, code, description, xml, qr, original chain, internal error, internal message, detail].
     */
    private function call(string $operation, array $params): array
    {
        try {
            $response = $this->client()->__soapCall($operation, ['parameters' => $params]);
        } catch (SoapFault $fault) {
            throw new InvoicingException('The invoicing service is unavailable: '.$fault->getMessage());
        }

        return array_values((array) ($response->{$operation.'Result'}->anyType ?? []));
    }

    private function client(): SoapClient
    {
        if (! extension_loaded('soap')) {
            throw new InvoicingException('The PHP SOAP extension is required to issue invoices.');
        }

        return $this->client ??= new SoapClient($this->wsdl, [
            'cache_wsdl' => WSDL_CACHE_MEMORY,
            'connection_timeout' => 20,
            'exceptions' => true,
            'stream_context' => stream_context_create([
                'ssl' => [
                    'verify_peer' => $this->verifySsl,
                    'verify_peer_name' => $this->verifySsl,
                ],
                'http' => ['user_agent' => 'PHPSoapClient'],
            ]),
        ]);
    }

    private function errorMessage(array $result): string
    {
        $message = trim((string) ($result[2] ?? ''));

        return $message !== '' ? $message : 'The invoicing service rejected the request (code '.($result[1] ?? '?').').';
    }
}
