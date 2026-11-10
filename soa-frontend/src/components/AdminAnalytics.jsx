import { useEffect, useState } from 'react'
import { money } from '../utils/reservation.js'

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function monthName(month) {
  const [year, number] = month.split('-')

  return `${MONTHS[Number(number) - 1]} ${year.slice(2)}`
}

function compactMoney(value) {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  }

  if (value >= 1000) {
    return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`
  }

  return `$${Math.round(value)}`
}

// Round step for the y axis so ticks land on readable values.
function niceMax(value) {
  if (value <= 0) {
    return 1000
  }

  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((factor) => factor * magnitude >= value / 4) * magnitude

  return Math.ceil(value / step) * step
}

// Column with a 4px rounded top, anchored square to the baseline.
function columnPath(x, y, width, height) {
  const r = Math.min(4, width / 2, height)

  return `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`
}

function RevenueChart({ months }) {
  const [hovered, setHovered] = useState(null)
  const width = 720
  const height = 240
  const pad = { top: 16, right: 8, bottom: 28, left: 52 }
  const plotWidth = width - pad.left - pad.right
  const plotHeight = height - pad.top - pad.bottom
  const max = niceMax(Math.max(...months.map((item) => item.revenue)))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * max)
  const slot = plotWidth / months.length
  const barWidth = Math.min(28, slot - 8)
  const best = months.reduce((top, item) => (item.revenue > top.revenue ? item : top), months[0])

  return (
    <div className="chart" onMouseLeave={() => setHovered(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Ingresos por mes, últimos 12 meses">
        {ticks.map((tick) => {
          const y = pad.top + plotHeight - (tick / max) * plotHeight

          return (
            <g key={tick} className="chart-grid">
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
              <text x={pad.left - 8} y={y} dy="0.32em" textAnchor="end">
                {compactMoney(tick)}
              </text>
            </g>
          )
        })}

        {months.map((item, index) => {
          const barHeight = (item.revenue / max) * plotHeight
          const x = pad.left + index * slot + (slot - barWidth) / 2
          const y = pad.top + plotHeight - barHeight

          return (
            <g key={item.month}>
              {barHeight > 0 && (
                <path
                  className={`chart-bar ${hovered === index ? 'active' : ''}`}
                  d={columnPath(x, y, barWidth, barHeight)}
                />
              )}

              {item === best && item.revenue > 0 && (
                <text className="chart-label" x={x + barWidth / 2} y={y - 6} textAnchor="middle">
                  {compactMoney(item.revenue)}
                </text>
              )}

              <text className="chart-axis" x={x + barWidth / 2} y={height - 8} textAnchor="middle">
                {monthName(item.month)}
              </text>

              {/* Hit target taller and wider than the bar. */}
              <rect
                className="chart-hit"
                x={pad.left + index * slot}
                y={pad.top}
                width={slot}
                height={plotHeight}
                onMouseEnter={() => setHovered(index)}
              />
            </g>
          )
        })}
      </svg>

      {hovered !== null && (
        <div
          className="chart-tooltip"
          style={{ left: `${((pad.left + (hovered + 0.5) * slot) / width) * 100}%` }}
        >
          <b>{monthName(months[hovered].month)}</b>
          <span>{money(months[hovered].revenue)}</span>
          <span>{months[hovered].nights} noches vendidas</span>
        </div>
      )}
    </div>
  )
}

/**
 * Advanced analytics of the hotel, open while it has a time pass.
 */
function AdminAnalytics({ gql }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [showTable, setShowTable] = useState(false)

  useEffect(() => {
    gql(`query Analytics { analytics }`)
      .then((result) => setData(result.analytics))
      .catch((err) => setError(err.message))
  }, [])

  if (error) {
    return <div className="simple-message error">{error}</div>
  }

  if (!data) {
    return <p className="simple-empty">Calculando analítica...</p>
  }

  const tiles = [
    { label: 'Ocupación (90 días)', value: `${data.occupancy_90d}%` },
    { label: 'Tarifa promedio (ADR)', value: money(data.adr_90d) },
    { label: 'Ingreso por habitación disponible (RevPAR)', value: money(data.revpar_90d) },
    { label: 'Estancia promedio', value: `${data.average_stay} noches` },
    { label: 'Anticipación promedio', value: `${data.average_lead_time} días` },
    { label: 'Cancelaciones (90 días)', value: `${data.cancellation_rate}%` },
    { label: 'Huéspedes que regresan', value: `${data.repeat_guest_rate}%`, note: `${data.guests} huéspedes en total` },
  ]

  return (
    <>
      <section className="simple-heading">
        <div>
          <h1>Analítica avanzada</h1>
          <p>Tendencias de ingresos, ocupación y comportamiento de tus huéspedes.</p>
        </div>
      </section>

      <section className="stat-grid">
        {tiles.map((tile) => (
          <article className="stat-tile" key={tile.label}>
            <span>{tile.label}</span>
            <strong>{tile.value}</strong>
            {tile.note && <small>{tile.note}</small>}
          </article>
        ))}
      </section>

      <section className="chart-card">
        <div className="chart-heading">
          <div>
            <h2>Ingresos por mes</h2>
            <p>Pagos recibidos en los últimos 12 meses.</p>
          </div>
          <button className="simple-link" onClick={() => setShowTable(!showTable)}>
            {showTable ? 'Ver gráfica' : 'Ver tabla'}
          </button>
        </div>

        {showTable ? (
          <table className="chart-table">
            <thead>
              <tr>
                <th>Mes</th>
                <th className="num">Ingresos</th>
                <th className="num">Noches vendidas</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((item) => (
                <tr key={item.month}>
                  <td>{monthName(item.month)}</td>
                  <td className="num">{money(item.revenue)}</td>
                  <td className="num">{item.nights}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <RevenueChart months={data.months} />
        )}
      </section>

      <section className="chart-card">
        <div className="chart-heading">
          <div>
            <h2>Ocupación por habitación</h2>
            <p>Noches vendidas en los últimos 90 días.</p>
          </div>
        </div>

        {data.rooms.length === 0 ? (
          <p className="simple-empty">No hay habitaciones en operación.</p>
        ) : (
          <ul className="room-bars">
            {data.rooms.map((room) => (
              <li key={room.number}>
                <span>
                  {room.number}
                  <small>{room.type}</small>
                </span>
                <div
                  className="meter"
                  role="meter"
                  aria-label={`Ocupación de la habitación ${room.number}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, room.occupancy)}
                >
                  <div style={{ width: `${Math.min(100, room.occupancy)}%` }} />
                </div>
                <b>{room.occupancy}%</b>
                <small>
                  {room.nights} noches · {money(room.revenue)}
                </small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

export default AdminAnalytics
