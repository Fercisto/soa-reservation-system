import { useEffect, useState } from 'react'
import { money } from '../utils/reservation.js'
import {
  CFDI_USES,
  RFC_PATTERN,
  cfdiUseLabel,
  downloadInvoiceXml,
  paymentFormLabel,
  readStampedXml,
  regimeLabel,
  regimesForRfc,
} from '../utils/invoice.js'

const EMPTY_FISCAL_DATA = {
  rfc: '',
  name: '',
  postal_code: '',
  tax_regime: '',
  cfdi_use: 'G03',
}

const INVOICE_FIELDS = `
  id
  status
  uuid
  series
  folio
  rfc
  name
  postal_code
  tax_regime
  cfdi_use
  payment_form
  subtotal
  tax
  total
  issued_at
  cancelled_at
`

/**
 * Requests the CFDI of a paid reservation, or shows the stamped invoice
 * when the reservation already has one.
 */
function InvoiceModal({ gql, reservation, onClose, onChanged }) {
  const [invoiceId, setInvoiceId] = useState(reservation.invoice?.id || null)
  const [invoice, setInvoice] = useState(null)
  const [fiscalData, setFiscalData] = useState(EMPTY_FISCAL_DATA)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (invoiceId) {
      loadInvoice(invoiceId)
    } else {
      loadLastFiscalData()
    }
  }, [invoiceId])

  async function loadInvoice(id) {
    try {
      const data = await gql(
        `
        query Invoice($id: ID!) {
          invoice(id: $id) { ${INVOICE_FIELDS} xml qr_code }
        }
      `,
        { id }
      )
      setInvoice(data.invoice)
    } catch (err) {
      setError(err.message)
    }
  }

  // The customer's last invoice fills the form, since fiscal data rarely changes.
  async function loadLastFiscalData() {
    try {
      const data = await gql(`
        query LastFiscalData {
          invoices { rfc name postal_code tax_regime cfdi_use }
        }
      `)
      const [last] = data.invoices

      if (last) {
        setFiscalData({
          rfc: last.rfc,
          name: last.name,
          postal_code: last.postal_code,
          tax_regime: last.tax_regime,
          cfdi_use: last.cfdi_use,
        })
      }
    } catch {
      // The form can still be filled by hand.
    }
  }

  async function requestInvoice(event) {
    event.preventDefault()

    if (!RFC_PATTERN.test(fiscalData.rfc)) {
      setError('El RFC no tiene un formato válido.')
      return
    }

    setBusy(true)
    setError('')

    try {
      const data = await gql(
        `
        mutation RequestInvoice($input: CreateInvoiceInput!) {
          requestInvoice(input: $input) { id }
        }
      `,
        {
          input: {
            reservation_id: Number(reservation.id),
            ...fiscalData,
          },
        }
      )

      setInvoiceId(data.requestInvoice.id)
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function cancelInvoice() {
    const confirmed = window.confirm(
      'La factura se cancelará ante el SAT y dejará de ser válida. La reservación sigue pagada y podrás volver a facturarla. ¿Continuar?'
    )

    if (!confirmed) {
      return
    }

    setBusy(true)
    setError('')
    setMessage('')

    try {
      await gql(
        `
        mutation CancelInvoice($id: ID!) {
          cancelInvoice(id: $id) { id }
        }
      `,
        { id: invoiceId }
      )

      await loadInvoice(invoiceId)
      setMessage('Factura cancelada. Ya puedes volver a facturar la reservación.')
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const regimes = regimesForRfc(fiscalData.rfc)

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && onClose()
      }
    >
      {invoiceId ? (
        <div className="room-modal invoice-modal">
          <div className="modal-header no-print">
            <h2>Factura</h2>
            <button type="button" className="simple-link" onClick={onClose}>
              Cerrar
            </button>
          </div>

          {message && (
            <div className="simple-message success no-print">{message}</div>
          )}

          {error && <div className="simple-message error no-print">{error}</div>}

          {!invoice ? (
            !error && <p className="simple-empty">Cargando factura...</p>
          ) : (
            <InvoiceSheet invoice={invoice} />
          )}

          {invoice && (
            <div className="modal-actions no-print">
              {invoice.status === 'issued' && (
                <button
                  type="button"
                  className="simple-danger invoice-cancel"
                  disabled={busy}
                  onClick={cancelInvoice}
                >
                  {busy ? 'Cancelando...' : 'Cancelar factura'}
                </button>
              )}
              <button
                type="button"
                className="simple-link"
                onClick={() => window.print()}
              >
                Imprimir o guardar PDF
              </button>
              <button
                type="button"
                className="simple-button"
                onClick={() => downloadInvoiceXml(invoice)}
              >
                Descargar XML
              </button>
            </div>
          )}
        </div>
      ) : (
        <form className="room-modal" onSubmit={requestInvoice}>
          <div className="modal-header">
            <h2>Solicitar factura</h2>
            <button type="button" className="simple-link" onClick={onClose}>
              Cerrar
            </button>
          </div>

          <p className="invoice-intro">
            Habitación {reservation.room?.number || reservation.room_id}, del{' '}
            {reservation.check_in} al {reservation.check_out}. Escribe tus datos
            tal como aparecen en tu Constancia de Situación Fiscal.
          </p>

          <label>
            RFC
            <input
              required
              maxLength={13}
              autoComplete="off"
              value={fiscalData.rfc}
              onChange={(event) => {
                const rfc = event.target.value.toUpperCase().replace(/\s/g, '')
                const stillValid = regimesForRfc(rfc).some(
                  (regime) => regime.code === fiscalData.tax_regime
                )

                setFiscalData({
                  ...fiscalData,
                  rfc,
                  tax_regime: stillValid ? fiscalData.tax_regime : '',
                })
              }}
            />
          </label>

          <label>
            Nombre o razón social
            <input
              required
              maxLength={254}
              value={fiscalData.name}
              onChange={(event) =>
                setFiscalData({
                  ...fiscalData,
                  name: event.target.value.toUpperCase(),
                })
              }
            />
          </label>

          <div className="modal-row">
            <label>
              Código postal fiscal
              <input
                required
                inputMode="numeric"
                pattern="\d{5}"
                maxLength={5}
                value={fiscalData.postal_code}
                onChange={(event) =>
                  setFiscalData({
                    ...fiscalData,
                    postal_code: event.target.value.replace(/\D/g, ''),
                  })
                }
              />
            </label>

            <label>
              Uso del CFDI
              <select
                required
                value={fiscalData.cfdi_use}
                onChange={(event) =>
                  setFiscalData({ ...fiscalData, cfdi_use: event.target.value })
                }
              >
                {CFDI_USES.map((use) => (
                  <option key={use.code} value={use.code}>
                    {use.code} - {use.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label>
            Régimen fiscal
            <select
              required
              value={fiscalData.tax_regime}
              onChange={(event) =>
                setFiscalData({ ...fiscalData, tax_regime: event.target.value })
              }
            >
              <option value="">Selecciona tu régimen fiscal</option>
              {regimes.map((regime) => (
                <option key={regime.code} value={regime.code}>
                  {regime.code} - {regime.label}
                </option>
              ))}
            </select>
          </label>

          {error && <div className="simple-message error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="simple-link" onClick={onClose}>
              Cancelar
            </button>
            <button className="simple-button" disabled={busy}>
              {busy ? 'Timbrando...' : 'Generar factura'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

/**
 * Printed representation of the CFDI.
 */
function InvoiceSheet({ invoice }) {
  const stamp = readStampedXml(invoice.xml || '')
  const cancelled = invoice.status === 'cancelled'

  return (
    <article className="invoice-sheet">
      <header className="invoice-sheet-header">
        <div>
          <span>Factura (CFDI 4.0 de ingreso)</span>
          <strong>
            {invoice.series}
            {invoice.folio}
          </strong>
        </div>
        <b className={`simple-status ${cancelled ? 'inactive' : 'available'}`}>
          {cancelled ? 'Cancelada' : 'Vigente'}
        </b>
      </header>

      <div className="invoice-parties">
        <section>
          <h3>Emisor</h3>
          <strong>{stamp.emitterName}</strong>
          <span>RFC: {stamp.emitterRfc}</span>
          <span>Régimen: {regimeLabel(stamp.emitterRegime)}</span>
          <span>Lugar de expedición: {stamp.placeOfIssue}</span>
        </section>

        <section>
          <h3>Receptor</h3>
          <strong>{invoice.name}</strong>
          <span>RFC: {invoice.rfc}</span>
          <span>Régimen: {regimeLabel(invoice.tax_regime)}</span>
          <span>C.P.: {invoice.postal_code}</span>
          <span>Uso: {cfdiUseLabel(invoice.cfdi_use)}</span>
        </section>
      </div>

      <table className="invoice-concepts">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Importe</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              {stamp.description}
              <small>Clave {stamp.productCode} · 1 servicio (E48)</small>
            </td>
            <td>{money(invoice.subtotal)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>Subtotal</td>
            <td>{money(invoice.subtotal)}</td>
          </tr>
          <tr>
            <td>IVA 16%</td>
            <td>{money(invoice.tax)}</td>
          </tr>
          <tr>
            <td>Total MXN</td>
            <td>{money(invoice.total)}</td>
          </tr>
        </tfoot>
      </table>

      <div className="invoice-stamp">
        {invoice.qr_code && (
          <img
            src={`data:image/jpeg;base64,${invoice.qr_code}`}
            alt="Código QR para verificar la factura en el SAT"
          />
        )}

        <dl>
          <dt>Folio fiscal (UUID)</dt>
          <dd>{invoice.uuid}</dd>
          <dt>Fecha de emisión</dt>
          <dd>{stamp.issuedAt}</dd>
          <dt>Fecha de timbrado</dt>
          <dd>{stamp.stampedAt}</dd>
          <dt>Forma y método de pago</dt>
          <dd>{paymentFormLabel(invoice.payment_form)} · PUE - Pago en una sola exhibición</dd>
          <dt>No. de certificado del emisor / SAT</dt>
          <dd>
            {stamp.certificate} / {stamp.satCertificate}
          </dd>
        </dl>
      </div>

      <div className="invoice-seals">
        <span>Sello digital del CFDI</span>
        <p>{stamp.cfdSeal}</p>
        <span>Sello del SAT</span>
        <p>{stamp.satSeal}</p>
      </div>

      <small className="invoice-footnote">
        Este documento es una representación impresa de un CFDI.
        {cancelled && ' La factura fue cancelada ante el SAT.'}
      </small>
    </article>
  )
}

export default InvoiceModal
