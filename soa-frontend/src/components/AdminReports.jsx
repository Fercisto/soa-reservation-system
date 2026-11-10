import { useEffect, useState } from 'react'
import { money } from '../utils/reservation.js'
import { formatDateTime } from '../utils/saas.js'

function monthRange() {
  const now = new Date()
  const pad = (value) => String(value).padStart(2, '0')
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

  return {
    from: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`,
    to: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(lastDay)}`,
  }
}

function downloadBase64Pdf(base64, filename) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Occupancy and income reports in PDF, paid with credits. Reports already generated
 * are kept and can be downloaded again for free.
 */
function AdminReports({ gql, account, catalog, refreshAccount, onOpenAccount }) {
  const [reports, setReports] = useState([])
  const [period, setPeriod] = useState(monthRange)
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const cost = catalog?.credit_features.find((feature) => feature.id === 'report')?.cost ?? 0
  const missing = Math.max(0, cost - (account?.credits || 0))

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    try {
      const data = await gql(`
        query Reports { reports { id from to credits data created_at user { id name } } }
      `)
      setReports(data.reports)
    } catch (err) {
      setError(err.message)
    }
  }

  async function generate(event) {
    event.preventDefault()

    if (!window.confirm(`Generar el reporte cuesta ${cost} créditos. ¿Continuar?`)) {
      return
    }

    setBusy('generate')
    setError('')
    setMessage('')

    try {
      const data = await gql(
        `mutation GenerateReport($from: String!, $to: String!) {
          generateReport(from: $from, to: $to) { id from to }
        }`,
        period
      )

      await Promise.all([loadReports(), refreshAccount()])
      setMessage('Reporte generado. Descargando el PDF...')
      await download(data.generateReport)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function download(report) {
    setBusy(report.id)

    try {
      const data = await gql(`query ReportPdf($id: ID!) { reportPdf(id: $id) }`, { id: report.id })
      downloadBase64Pdf(data.reportPdf, `reporte-${report.from}-${report.to}.pdf`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <section className="simple-heading">
        <div>
          <h1>Reportes</h1>
          <p>
            Reporte en PDF de ocupación e ingresos por habitación. Cuesta {cost}{' '}
            créditos y queda guardado para descargarlo otra vez sin costo.
          </p>
        </div>
      </section>

      {message && <div className="simple-message success">{message}</div>}
      {error && <div className="simple-message error">{error}</div>}

      <form className="report-form" onSubmit={generate}>
        <label>
          Desde
          <input
            type="date"
            required
            value={period.from}
            onChange={(event) => setPeriod({ ...period, from: event.target.value })}
          />
        </label>

        <label>
          Hasta
          <input
            type="date"
            required
            min={period.from}
            value={period.to}
            onChange={(event) => setPeriod({ ...period, to: event.target.value })}
          />
        </label>

        <div className="report-cost">
          <span>
            Costo: <b>{cost} créditos</b>
          </span>
          <small>Saldo: {account?.credits ?? 0}</small>
        </div>

        {missing > 0 ? (
          <button type="button" className="simple-button" onClick={onOpenAccount}>
            Comprar créditos
          </button>
        ) : (
          <button className="simple-button" disabled={busy !== null}>
            {busy === 'generate' ? 'Generando...' : 'Generar reporte'}
          </button>
        )}
      </form>

      <section className="simple-table-card">
        <table>
          <thead>
            <tr>
              <th>Periodo</th>
              <th className="num">Ocupación</th>
              <th className="num">Ingreso por habitaciones</th>
              <th className="num">Noches vendidas</th>
              <th>Generado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr>
                <td colSpan="6" className="simple-empty">
                  Todavía no has generado reportes.
                </td>
              </tr>
            ) : (
              reports.map((report) => (
                <tr key={report.id}>
                  <td>
                    {report.from} al {report.to}
                  </td>
                  <td className="num">{report.data.occupancy}%</td>
                  <td className="num">{money(report.data.room_revenue)}</td>
                  <td className="num">{report.data.booked_nights}</td>
                  <td>
                    {formatDateTime(report.created_at)}
                    <span className="cell-note">
                      {report.user?.name} · {report.credits} créditos
                    </span>
                  </td>
                  <td>
                    <button
                      className="simple-link"
                      disabled={busy !== null}
                      onClick={() => download(report)}
                    >
                      {busy === report.id ? 'Descargando...' : 'Descargar PDF'}
                    </button>
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

export default AdminReports
