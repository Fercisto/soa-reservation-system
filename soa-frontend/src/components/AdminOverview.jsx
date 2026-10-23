import { useEffect, useState } from 'react'
import { money, reservationNights } from '../utils/reservation.js'

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function monthLabel(month) {
  const [year, number] = (month || '').split('-')

  return number ? `${MONTHS[Number(number) - 1]} ${year}` : ''
}

function StatTile({ label, value, note }) {
  return (
    <article className="stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </article>
  )
}

/**
 * Admin dashboard: this month's income and invoicing, today's occupancy and
 * what needs attention. Figures are computed by Laravel (GET /api/admin/summary).
 */
function AdminOverview({ gql, onOpenTab }) {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSummary()
  }, [])

  async function loadSummary() {
    try {
      const data = await gql(`
        query AdminSummary {
          adminSummary {
            today
            month
            revenue_month
            payments_month
            refunds_month
            invoiced_month
            invoices_month
            uninvoiced_amount
            uninvoiced_count
            occupied_rooms
            rooms
            occupancy_rate
            arrivals_today
            departures_today
            active_reservations
            pending_payments
            upcoming_arrivals {
              id
              check_in
              check_out
              room { number type }
              user { name email }
            }
          }
        }
      `)

      setSummary(data.adminSummary)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  if (error) {
    return <div className="simple-message error">{error}</div>
  }

  if (!summary) {
    return <p className="simple-empty">Cargando resumen...</p>
  }

  const occupancy = Math.min(100, summary.occupancy_rate)

  return (
    <>
      <section className="simple-heading">
        <div>
          <h1>Resumen</h1>
          <p>
            Cifras de {monthLabel(summary.month)} y del día {summary.today}.
          </p>
        </div>

        <button className="simple-link" onClick={loadSummary}>
          Actualizar
        </button>
      </section>

      <section className="overview-hero">
        <div>
          <span>Ingresos del mes</span>
          <strong>{money(summary.revenue_month)}</strong>
          <small>
            {summary.payments_month}{' '}
            {summary.payments_month === 1 ? 'pago recibido' : 'pagos recibidos'}
            {summary.refunds_month > 0 &&
              ` · ${money(summary.refunds_month)} reembolsados`}
          </small>
        </div>

        <div className="overview-occupancy">
          <span>Ocupación hoy</span>
          <strong>{summary.occupancy_rate}%</strong>
          <div
            className="meter"
            role="meter"
            aria-label="Ocupación hoy"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={occupancy}
          >
            <div style={{ width: `${occupancy}%` }} />
          </div>
          <small>
            {summary.occupied_rooms} de {summary.rooms} habitaciones con
            huésped
          </small>
        </div>
      </section>

      <section className="stat-grid">
        <StatTile
          label="Llegadas hoy"
          value={summary.arrivals_today}
          note={`${summary.departures_today} ${
            summary.departures_today === 1 ? 'salida' : 'salidas'
          } hoy`}
        />
        <StatTile
          label="Reservaciones activas"
          value={summary.active_reservations}
          note="Confirmadas y sin terminar"
        />
        <StatTile
          label="Pendientes de pago"
          value={summary.pending_payments}
          note="Esperando el pago en Stripe"
        />
        <StatTile
          label="Facturado en el mes"
          value={money(summary.invoiced_month)}
          note={`${summary.invoices_month} ${
            summary.invoices_month === 1 ? 'factura vigente' : 'facturas vigentes'
          }`}
        />
        <StatTile
          label="Pagado sin facturar"
          value={money(summary.uninvoiced_amount)}
          note={`${summary.uninvoiced_count} ${
            summary.uninvoiced_count === 1 ? 'reservación' : 'reservaciones'
          }`}
        />
      </section>

      <section className="simple-table-card overview-arrivals">
        <div className="table-filters">
          <strong>Próximas llegadas (7 días)</strong>
          <button
            className="simple-link overview-link"
            onClick={() => onOpenTab('rooms')}
          >
            Ver reservaciones
          </button>
        </div>

        <table>
          <thead>
            <tr>
              <th>Entrada</th>
              <th>Huésped</th>
              <th>Habitación</th>
              <th>Noches</th>
            </tr>
          </thead>
          <tbody>
            {summary.upcoming_arrivals.length === 0 ? (
              <tr>
                <td colSpan="4" className="simple-empty">
                  No hay llegadas confirmadas en los próximos 7 días.
                </td>
              </tr>
            ) : (
              summary.upcoming_arrivals.map((reservation) => (
                <tr key={reservation.id}>
                  <td>
                    {reservation.check_in === summary.today
                      ? 'Hoy'
                      : reservation.check_in}
                  </td>
                  <td>
                    <strong>{reservation.user?.name}</strong>
                    <span className="cell-note">{reservation.user?.email}</span>
                  </td>
                  <td>
                    {reservation.room?.number}
                    <span className="cell-note">{reservation.room?.type}</span>
                  </td>
                  <td>
                    {reservationNights(reservation.check_in, reservation.check_out)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}

export default AdminOverview
