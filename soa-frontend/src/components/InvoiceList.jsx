import { useEffect, useState } from 'react'
import InvoiceModal from './InvoiceModal.jsx'
import { money } from '../utils/reservation.js'

/**
 * CFDIs stamped through Profact: every invoice for admins, own invoices for customers.
 */
function InvoiceList({ gql, isAdmin = false, onChanged }) {
  const [invoices, setInvoices] = useState([])
  const [status, setStatus] = useState('')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadInvoices()
  }, [status])

  async function loadInvoices() {
    try {
      const data = await gql(
        `
        query InvoiceList($status: String) {
          invoices(status: $status) {
            id
            status
            uuid
            series
            folio
            rfc
            name
            total
            issued_at
            reservation {
              id
              room_id
              check_in
              check_out
              room { number }
            }
            ${isAdmin ? 'user { name email }' : 'hotel { name slug }'}
          }
        }
      `,
        { status: status || null }
      )

      setInvoices(data.invoices)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setReady(true)
    }
  }

  async function cancelInvoice(invoice) {
    const confirmed = window.confirm(
      `La factura ${invoice.series}${invoice.folio} se cancelará ante el SAT y dejará de ser válida. La reservación sigue pagada y se podrá volver a facturar. ¿Continuar?`
    )

    if (!confirmed) {
      return
    }

    setCancellingId(invoice.id)
    setMessage('')
    setError('')

    try {
      await gql(
        `
        mutation CancelInvoice($id: ID!) {
          cancelInvoice(id: $id) { id }
        }
      `,
        { id: invoice.id }
      )

      setMessage(
        `Factura ${invoice.series}${invoice.folio} cancelada.${
          isAdmin ? '' : ' Puedes volver a facturar la reservación en Mis reservaciones.'
        }`
      )
      await loadInvoices()
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setCancellingId(null)
    }
  }

  const issuedTotal = invoices
    .filter((invoice) => invoice.status === 'issued')
    .reduce((sum, invoice) => sum + Number(invoice.total), 0)

  return (
    <>
      <section className="simple-heading">
        <div>
          <h1>Facturas</h1>
          <p>
            {isAdmin
              ? 'Facturas electrónicas (CFDI 4.0) emitidas a los huéspedes y timbradas con Profact.'
              : 'Tus facturas electrónicas (CFDI 4.0). Para facturar una estancia pagada, usa el botón Facturar en Mis reservaciones.'}
          </p>
        </div>
      </section>

      {message && <div className="simple-message success">{message}</div>}

      {error && <div className="simple-message error">{error}</div>}

      <section className="simple-table-card">
        <div className="table-filters">
          <label>
            Estado
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">Todas</option>
              <option value="issued">Vigentes</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </label>

          <span className="invoice-summary">
            Total facturado vigente: <strong>{money(issuedTotal)}</strong>
          </span>
        </div>

        <table>
          <thead>
            <tr>
              <th>Folio</th>
              <th>Receptor</th>
              <th>Reservación</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Folio fiscal</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {!ready ? (
              <tr>
                <td colSpan="7" className="simple-empty">
                  Cargando facturas...
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan="7" className="simple-empty">
                  Todavía no hay facturas{status ? ' con ese estado' : ''}.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>
                    {invoice.series}
                    {invoice.folio}
                  </td>
                  <td>
                    <strong>{invoice.name}</strong>
                    <span className="cell-note">
                      {invoice.rfc}
                      {isAdmin && ` · ${invoice.user?.name}`}
                    </span>
                  </td>
                  <td>
                    {!isAdmin && invoice.hotel && (
                      <span className="cell-note">{invoice.hotel.name}</span>
                    )}
                    Habitación{' '}
                    {invoice.reservation?.room?.number ||
                      invoice.reservation?.room_id}
                    <span className="cell-note">
                      {invoice.reservation?.check_in} al{' '}
                      {invoice.reservation?.check_out}
                    </span>
                  </td>
                  <td>{money(invoice.total)}</td>
                  <td>
                    <span
                      className={`simple-status ${
                        invoice.status === 'issued' ? 'available' : 'inactive'
                      }`}
                    >
                      {invoice.status === 'issued' ? 'Vigente' : 'Cancelada'}
                    </span>
                  </td>
                  <td className="invoice-uuid">{invoice.uuid}</td>
                  <td>
                    <div className="simple-actions">
                      <button
                        className="simple-link"
                        onClick={() => setSelected(invoice)}
                      >
                        Ver
                      </button>

                      {invoice.status === 'issued' && (
                        <button
                          className="simple-danger"
                          disabled={cancellingId !== null}
                          onClick={() => cancelInvoice(invoice)}
                        >
                          {cancellingId === invoice.id ? 'Cancelando...' : 'Cancelar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {selected && (
        <InvoiceModal
          gql={gql}
          reservation={{ ...selected.reservation, invoice: { id: selected.id } }}
          onClose={() => setSelected(null)}
          onChanged={() => {
            loadInvoices()
            onChanged?.()
          }}
        />
      )}
    </>
  )
}

export default InvoiceList
