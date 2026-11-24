import { useEffect, useState } from 'react'
import NotificationBell from './NotificationBell.jsx'
import { PLATFORM_NAME } from '../utils/brand.js'
import { money } from '../utils/reservation.js'
import { formatDate, formatDateTime } from '../utils/saas.js'

const TABS = [
  { id: 'services', label: 'Servicios' },
  { id: 'logs', label: 'Bitácora' },
  { id: 'hotels', label: 'Hoteles' },
]

const STATUS = {
  up: { label: 'Operando', tone: 'available' },
  degraded: { label: 'Con fallas', tone: 'occupied' },
  down: { label: 'Sin respuesta', tone: 'down' },
  disabled: { label: 'Desactivado', tone: 'inactive' },
}

const GROUPS = ['Gateway', 'Laravel', 'Mensajería', 'Externo']

const REFRESH_MS = 10000

function formatTimeShort(value) {
  return new Date(value).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

/**
 * Health of every service, with RabbitMQ queues. Refreshes every 10 seconds.
 */
function ServicesTab({ gql }) {
  const [status, setStatus] = useState(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    check()
    const timer = setInterval(check, REFRESH_MS)
    return () => clearInterval(timer)
  }, [])

  async function check() {
    setChecking(true)

    try {
      const data = await gql(`
        query ServiceStatus {
          serviceStatus {
            checked_at
            management_url
            services { id name group status latency_ms detail }
            queues { name messages consumers }
          }
        }
      `)
      setStatus(data.serviceStatus)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setChecking(false)
    }
  }

  const services = status?.services || []
  const down = services.filter((service) => ['down', 'degraded'].includes(service.status))

  return (
    <>
      <section className="simple-heading">
        <div>
          <h1>Estado de los servicios</h1>
          <p>
            {status
              ? `Revisado a las ${formatTimeShort(status.checked_at)} · se actualiza cada 10 segundos.`
              : 'Revisando los servicios...'}
          </p>
        </div>
        <button className="simple-link" disabled={checking} onClick={check}>
          {checking ? 'Revisando...' : 'Revisar ahora'}
        </button>
      </section>

      {error && <div className="simple-message error">{error}</div>}

      {status && (
        <div className={`simple-message ${down.length ? 'error' : 'success'}`}>
          {down.length
            ? `${down.length} ${down.length === 1 ? 'servicio tiene' : 'servicios tienen'} problemas: ${down.map((service) => service.name).join(', ')}.`
            : 'Todos los servicios activos están operando.'}
        </div>
      )}

      {GROUPS.map((group) => {
        const items = services.filter((service) => service.group === group)

        if (items.length === 0) {
          return null
        }

        return (
          <section key={group} className="service-group">
            <h2>{group}</h2>
            <div className="service-cards">
              {items.map((service) => {
                const state = STATUS[service.status] || STATUS.down

                return (
                  <article key={service.id} className={`service-card status-${service.status}`}>
                    <div>
                      <strong>{service.name}</strong>
                      <span className={`simple-status ${state.tone}`}>
                        <i className="status-dot" aria-hidden="true" />
                        {state.label}
                      </span>
                    </div>
                    <p>{service.detail}</p>
                    {service.latency_ms !== null && service.status !== 'disabled' && (
                      <small>{service.latency_ms} ms</small>
                    )}
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}

      {status && (
        <section className="service-group">
          <div className="queue-heading">
            <h2>Colas de RabbitMQ</h2>
            {status.management_url && (
              <a className="simple-link" href={status.management_url} target="_blank" rel="noreferrer">
                Abrir panel de RabbitMQ
              </a>
            )}
          </div>

          <div className="simple-table-card">
            <table>
              <thead>
                <tr>
                  <th>Cola</th>
                  <th>Para qué</th>
                  <th className="num">Mensajes en espera</th>
                  <th className="num">Consumidores</th>
                </tr>
              </thead>
              <tbody>
                {status.queues.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="simple-empty">
                      No hay conexión con RabbitMQ.
                    </td>
                  </tr>
                ) : (
                  status.queues.map((queue) => (
                    <tr key={queue.name}>
                      <td className="invoice-uuid">{queue.name}</td>
                      <td>
                        {queue.name.endsWith('service_logs')
                          ? 'Bitácora de uso (publica NestJS)'
                          : queue.name.endsWith('notifications')
                            ? 'Notificaciones (publica Laravel)'
                            : 'Mensajes que fallaron al procesarse'}
                      </td>
                      <td className="num">{queue.messages}</td>
                      <td className={`num ${queue.consumers === 0 && !queue.name.endsWith('failed') ? 'credit-out' : ''}`}>
                        {queue.consumers}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="module-note">
            Si los consumidores están en 0, los mensajes se acumulan hasta que se ejecute{' '}
            <code>php artisan hospedia:consume</code>; no se pierden.
          </p>
        </section>
      )}
    </>
  )
}

function HourlyChart({ hours }) {
  const [hovered, setHovered] = useState(null)
  const width = 720
  const height = 150
  const pad = { top: 12, bottom: 22, left: 8, right: 8 }
  const plot = height - pad.top - pad.bottom
  const max = Math.max(1, ...hours.map((hour) => hour.calls))
  const slot = (width - pad.left - pad.right) / hours.length
  const bar = Math.min(18, slot - 4)

  return (
    <div className="chart" onMouseLeave={() => setHovered(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Llamadas por hora, últimas 24 horas">
        <line className="chart-baseline" x1={pad.left} x2={width - pad.right} y1={pad.top + plot} y2={pad.top + plot} />
        {hours.map((hour, index) => {
          const h = (hour.calls / max) * plot
          const x = pad.left + index * slot + (slot - bar) / 2

          return (
            <g key={hour.hour}>
              {h > 0 && (
                <rect
                  className={`chart-bar ${hovered === index ? 'active' : ''}`}
                  x={x}
                  y={pad.top + plot - h}
                  width={bar}
                  height={h}
                  rx="3"
                />
              )}
              {index % 3 === 0 && (
                <text className="chart-axis" x={x + bar / 2} y={height - 6} textAnchor="middle">
                  {new Date(hour.hour).getHours()}:00
                </text>
              )}
              <rect
                className="chart-hit"
                x={pad.left + index * slot}
                y={pad.top}
                width={slot}
                height={plot}
                onMouseEnter={() => setHovered(index)}
              />
            </g>
          )
        })}
      </svg>
      {hovered !== null && (
        <div className="chart-tooltip" style={{ left: `${((pad.left + (hovered + 0.5) * slot) / width) * 100}%` }}>
          <b>{new Date(hours[hovered].hour).getHours()}:00 h</b>
          <span>{hours[hovered].calls} llamadas</span>
          <span>{hours[hovered].errors} con error</span>
        </div>
      )}
    </div>
  )
}

/**
 * Usage log received through RabbitMQ, with the last 24 hours summarized.
 */
function LogsTab({ gql, hotels }) {
  const [summary, setSummary] = useState(null)
  const [logs, setLogs] = useState(null)
  const [filters, setFilters] = useState({ service: '', result: '', hotelId: '', search: '' })
  const [page, setPage] = useState(1)
  const [live, setLive] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [filters, page])

  useEffect(() => {
    if (!live) {
      return
    }

    const timer = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer)
  }, [live, filters, page])

  async function load() {
    try {
      const data = await gql(
        `
        query ServiceLogs($service: String, $result: String, $hotelId: Int, $search: String, $page: Int) {
          serviceLogSummary { calls errors average_ms services hours all_services }
          serviceLogs(service: $service, result: $result, hotelId: $hotelId, search: $search, page: $page) {
            total page last_page
            data {
              id service operation kind source actor role success status_code error duration_ms occurred_at
              hotel { id name slug }
            }
          }
        }
      `,
        {
          service: filters.service || null,
          result: filters.result || null,
          hotelId: filters.hotelId ? Number(filters.hotelId) : null,
          search: filters.search.trim() || null,
          page,
        }
      )
      setSummary(data.serviceLogSummary)
      setLogs(data.serviceLogs)
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }

  function filter(field) {
    return (event) => {
      setPage(1)
      setFilters({ ...filters, [field]: event.target.value })
    }
  }

  const maxCalls = Math.max(1, ...(summary?.services || []).map((service) => service.calls))
  const errorRate = summary?.calls ? Math.round((summary.errors / summary.calls) * 1000) / 10 : 0

  return (
    <>
      <section className="simple-heading">
        <div>
          <h1>Bitácora de servicios</h1>
          <p>
            Cada uso de un servicio llega por RabbitMQ: NestJS publica el evento y el consumidor de
            Laravel lo guarda.
          </p>
        </div>
        <label className="checkbox-label live-toggle">
          <input type="checkbox" checked={live} onChange={(event) => setLive(event.target.checked)} />
          Actualizar en vivo
        </label>
      </section>

      {error && <div className="simple-message error">{error}</div>}

      {summary && (
        <>
          <section className="stat-grid">
            <article className="stat-tile">
              <span>Llamadas (24 h)</span>
              <strong>{summary.calls.toLocaleString('es-MX')}</strong>
            </article>
            <article className="stat-tile">
              <span>Con error (24 h)</span>
              <strong>{summary.errors.toLocaleString('es-MX')}</strong>
              <small>{errorRate}% del total</small>
            </article>
            <article className="stat-tile">
              <span>Tiempo de respuesta promedio</span>
              <strong>{summary.average_ms} ms</strong>
            </article>
            <article className="stat-tile">
              <span>Servicios usados (24 h)</span>
              <strong>{summary.services.length}</strong>
            </article>
          </section>

          <section className="chart-card">
            <div className="chart-heading">
              <div>
                <h2>Llamadas por hora</h2>
                <p>Últimas 24 horas.</p>
              </div>
            </div>
            <HourlyChart hours={summary.hours} />
          </section>

          <section className="chart-card">
            <div className="chart-heading">
              <div>
                <h2>Uso por servicio</h2>
                <p>Últimas 24 horas. Haz clic en un servicio para filtrar la bitácora.</p>
              </div>
            </div>
            <ul className="room-bars service-bars">
              {summary.services.map((service) => (
                <li key={service.service}>
                  <button
                    className="simple-link"
                    onClick={() => {
                      setPage(1)
                      setFilters({ ...filters, service: service.service })
                    }}
                  >
                    {service.service}
                  </button>
                  <div className="meter" aria-hidden="true">
                    <div style={{ width: `${(service.calls / maxCalls) * 100}%` }} />
                  </div>
                  <b>{service.calls}</b>
                  <small>
                    {service.errors} con error · {service.average_ms} ms promedio
                  </small>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section className="simple-table-card logs-card">
        <div className="table-filters">
          <label>
            Servicio
            <select value={filters.service} onChange={filter('service')}>
              <option value="">Todos</option>
              {(summary?.all_services || []).map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </label>
          <label>
            Resultado
            <select value={filters.result} onChange={filter('result')}>
              <option value="">Todos</option>
              <option value="ok">Correctos</option>
              <option value="error">Con error</option>
            </select>
          </label>
          <label>
            Hotel
            <select value={filters.hotelId} onChange={filter('hotelId')}>
              <option value="">Todos</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Buscar
            <input
              type="search"
              placeholder="Operación, usuario o error"
              value={filters.search}
              onChange={filter('search')}
            />
          </label>
        </div>

        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Servicio</th>
              <th>Operación</th>
              <th>Quién</th>
              <th>Hotel</th>
              <th>Resultado</th>
              <th className="num">Duración</th>
            </tr>
          </thead>
          <tbody>
            {!logs ? (
              <tr>
                <td colSpan="7" className="simple-empty">Cargando bitácora...</td>
              </tr>
            ) : logs.data.length === 0 ? (
              <tr>
                <td colSpan="7" className="simple-empty">No hay registros con esos filtros.</td>
              </tr>
            ) : (
              logs.data.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.occurred_at)}</td>
                  <td>{log.service}</td>
                  <td>
                    <code>{log.operation}</code>
                    <span className="cell-note">
                      {log.kind} · {log.source === 'worker' ? 'consumidor Laravel' : 'gateway NestJS'}
                    </span>
                  </td>
                  <td>
                    {log.actor || 'Visitante'}
                    {log.role && <span className="cell-note">{log.role}</span>}
                  </td>
                  <td>{log.hotel?.name || '—'}</td>
                  <td>
                    <span className={`simple-status ${log.success ? 'available' : 'down'}`}>
                      {log.success ? 'Correcto' : `Error ${log.status_code || ''}`}
                    </span>
                    {log.error && <span className="cell-note">{log.error}</span>}
                  </td>
                  <td className="num">{log.duration_ms} ms</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {logs && logs.last_page > 1 && (
          <div className="pagination">
            <button className="simple-link" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Anterior
            </button>
            <span>
              Página {logs.page} de {logs.last_page} · {logs.total.toLocaleString('es-MX')} registros
            </span>
            <button className="simple-link" disabled={page >= logs.last_page} onClick={() => setPage(page + 1)}>
              Siguiente
            </button>
          </div>
        )}
      </section>
    </>
  )
}

function HotelsTab({ hotels, error }) {
  const active = hotels.filter((hotel) => hotel.plan_active)
  const byPlan = (plan) => active.filter((hotel) => hotel.plan === plan).length

  return (
    <>
      <section className="simple-heading">
        <div>
          <h1>Hoteles en {PLATFORM_NAME}</h1>
          <p>Todos los hoteles registrados, con su plan, créditos y última actividad.</p>
        </div>
      </section>

      {error && <div className="simple-message error">{error}</div>}

      <section className="stat-grid">
        <article className="stat-tile">
          <span>Hoteles registrados</span>
          <strong>{hotels.length}</strong>
          <small>{active.length} con plan activo</small>
        </article>
        <article className="stat-tile">
          <span>Gold</span>
          <strong>{byPlan('gold')}</strong>
        </article>
        <article className="stat-tile">
          <span>Silver</span>
          <strong>{byPlan('silver')}</strong>
        </article>
        <article className="stat-tile">
          <span>Bronze</span>
          <strong>{byPlan('bronze')}</strong>
        </article>
      </section>

      <section className="simple-table-card">
        <table>
          <thead>
            <tr>
              <th>Hotel</th>
              <th>Plan</th>
              <th>Vence</th>
              <th className="num">Créditos</th>
              <th className="num">Habitaciones</th>
              <th className="num">Reservaciones</th>
              <th>Administradores</th>
              <th>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {hotels.map((hotel) => (
              <tr key={hotel.id}>
                <td>
                  <strong>{hotel.name}</strong>
                  <span className="cell-note">{hotel.city}</span>
                </td>
                <td>
                  <span className={`simple-status ${hotel.plan_active ? 'available' : 'down'}`}>
                    {hotel.plan_active ? hotel.plan_name : hotel.plan ? `${hotel.plan_name} vencido` : 'Sin plan'}
                  </span>
                </td>
                <td>{hotel.plan_expires_at ? formatDate(hotel.plan_expires_at) : '—'}</td>
                <td className="num">{hotel.credits}</td>
                <td className="num">
                  {hotel.rooms_count}
                  {hotel.room_limit ? ` / ${hotel.room_limit}` : ''}
                </td>
                <td className="num">{hotel.reservations_count}</td>
                <td>
                  {hotel.admins.map((admin) => (
                    <span key={admin.id} className="cell-note">
                      {admin.email}
                    </span>
                  ))}
                </td>
                <td>{hotel.last_activity_at ? formatDateTime(hotel.last_activity_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="module-note">
        Precio de referencia: Bronze {money(499)}, Silver {money(999)} y Gold {money(1999)} al mes.
      </p>
    </>
  )
}

/**
 * Panel of the platform operator (superadmin).
 */
function PlatformDashboard({ gql, logout, notificationProps }) {
  const [tab, setTab] = useState('services')
  const [hotels, setHotels] = useState([])
  const [hotelsError, setHotelsError] = useState('')

  useEffect(() => {
    gql(`query PlatformHotels { platformHotels }`)
      .then((data) => setHotels(data.platformHotels))
      .catch((err) => setHotelsError(err.message))
  }, [])

  return (
    <main className="simple-app">
      <header className="simple-nav">
        <strong className="brand">
          {PLATFORM_NAME}
          <small>Operación de la plataforma</small>
        </strong>

        <div className="nav-actions">
          <NotificationBell {...notificationProps} />
          <button className="simple-link" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Secciones">
        {TABS.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? 'active' : ''}
            aria-current={tab === item.id ? 'page' : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'services' && <ServicesTab gql={gql} />}
      {tab === 'logs' && <LogsTab gql={gql} hotels={hotels} />}
      {tab === 'hotels' && <HotelsTab hotels={hotels} error={hotelsError} />}
    </main>
  )
}

export default PlatformDashboard
