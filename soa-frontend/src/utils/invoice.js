// SAT c_RegimenFiscal. 12-character RFCs are companies, 13-character RFCs are individuals.
export const TAX_REGIMES = [
  { code: '601', label: 'General de Ley Personas Morales', company: true },
  { code: '603', label: 'Personas Morales con Fines no Lucrativos', company: true },
  { code: '605', label: 'Sueldos y Salarios e Ingresos Asimilados a Salarios' },
  { code: '606', label: 'Arrendamiento' },
  { code: '607', label: 'Régimen de Enajenación o Adquisición de Bienes' },
  { code: '608', label: 'Demás ingresos' },
  { code: '610', label: 'Residentes en el Extranjero sin Establecimiento Permanente en México', company: true, person: true },
  { code: '611', label: 'Ingresos por Dividendos (socios y accionistas)' },
  { code: '612', label: 'Personas Físicas con Actividades Empresariales y Profesionales' },
  { code: '614', label: 'Ingresos por intereses' },
  { code: '615', label: 'Régimen de los ingresos por obtención de premios' },
  { code: '616', label: 'Sin obligaciones fiscales' },
  { code: '620', label: 'Sociedades Cooperativas de Producción', company: true },
  { code: '621', label: 'Incorporación Fiscal' },
  { code: '622', label: 'Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras', company: true },
  { code: '623', label: 'Opcional para Grupos de Sociedades', company: true },
  { code: '624', label: 'Coordinados', company: true },
  { code: '625', label: 'Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
  { code: '626', label: 'Régimen Simplificado de Confianza', company: true, person: true },
]

export const CFDI_USES = [
  { code: 'G03', label: 'Gastos en general' },
  { code: 'S01', label: 'Sin efectos fiscales' },
]

const PAYMENT_FORMS = {
  '01': 'Efectivo',
  '04': 'Tarjeta de crédito',
  '99': 'Por definir',
}

export const RFC_PATTERN = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/

// Regimes that apply to the RFC typed so far; all of them while it is incomplete.
export function regimesForRfc(rfc) {
  if (rfc.length === 12) {
    return TAX_REGIMES.filter((regime) => regime.company)
  }

  if (rfc.length === 13) {
    return TAX_REGIMES.filter((regime) => !regime.company || regime.person)
  }

  return TAX_REGIMES
}

export function regimeLabel(code) {
  const regime = TAX_REGIMES.find((item) => item.code === code)

  return regime ? `${code} - ${regime.label}` : code
}

export function cfdiUseLabel(code) {
  const use = CFDI_USES.find((item) => item.code === code)

  return use ? `${code} - ${use.label}` : code
}

export function paymentFormLabel(code) {
  return PAYMENT_FORMS[code] ? `${code} - ${PAYMENT_FORMS[code]}` : code
}

export function invoiceStatusLabel(invoice) {
  return invoice?.status === 'cancelled' ? 'Factura cancelada' : 'Facturada'
}

export function downloadInvoiceXml(invoice) {
  const blob = new Blob([invoice.xml], { type: 'application/xml' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = `factura-${invoice.series}${invoice.folio}-${invoice.uuid}.xml`
  link.click()
  URL.revokeObjectURL(url)
}

// Emitter and SAT stamp data are read from the stamped XML.
export function readStampedXml(xml) {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  const attribute = (tag, name) =>
    document.getElementsByTagName(tag)[0]?.getAttribute(name) || ''

  return {
    emitterRfc: attribute('cfdi:Emisor', 'Rfc'),
    emitterName: attribute('cfdi:Emisor', 'Nombre'),
    emitterRegime: attribute('cfdi:Emisor', 'RegimenFiscal'),
    placeOfIssue: attribute('cfdi:Comprobante', 'LugarExpedicion'),
    issuedAt: attribute('cfdi:Comprobante', 'Fecha'),
    certificate: attribute('cfdi:Comprobante', 'NoCertificado'),
    description: attribute('cfdi:Concepto', 'Descripcion'),
    productCode: attribute('cfdi:Concepto', 'ClaveProdServ'),
    stampedAt: attribute('tfd:TimbreFiscalDigital', 'FechaTimbrado'),
    satCertificate: attribute('tfd:TimbreFiscalDigital', 'NoCertificadoSAT'),
    cfdSeal: attribute('tfd:TimbreFiscalDigital', 'SelloCFD'),
    satSeal: attribute('tfd:TimbreFiscalDigital', 'SelloSAT'),
  }
}
