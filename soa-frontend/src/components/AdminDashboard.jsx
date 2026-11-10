import { useState } from 'react'
import NotificationBell from './NotificationBell.jsx'
import RoomModal from './RoomModal.jsx'
import AdminReservations from './AdminReservations.jsx'
import AdminMenu from './AdminMenu.jsx'
import AdminStaff from './AdminStaff.jsx'
import InvoiceList from './InvoiceList.jsx'
import AdminOverview from './AdminOverview.jsx'
import InvoiceModal from './InvoiceModal.jsx'
import AdminAccount from './AdminAccount.jsx'
import AdminReports from './AdminReports.jsx'
import AdminAnalytics from './AdminAnalytics.jsx'
import AdminCampaigns from './AdminCampaigns.jsx'
import LockedModule from './LockedModule.jsx'
import PassGate from './PassGate.jsx'
import { PLATFORM_NAME } from '../utils/brand.js'
import { formatRemaining, passEndsAt, planFor } from '../utils/saas.js'

// feature: module of the plan · credits: charged per use · pass: opened with a time pass.
const TABS = [
  { id: 'overview', label: 'Resumen', feature: 'overview' },
  { id: 'rooms', label: 'Habitaciones', feature: 'rooms' },
  { id: 'menu', label: 'Menú', feature: 'restaurant' },
  { id: 'staff', label: 'Personal', feature: 'staff' },
  { id: 'invoices', label: 'Facturas', credits: true },
  { id: 'reports', label: 'Reportes', credits: true },
  { id: 'analytics', label: 'Analítica', pass: 'analytics' },
  { id: 'campaigns', label: 'Campañas', pass: 'campaigns' },
  { id: 'account', label: 'Mi plan' },
]

function defaultTab(account) {
  if (!account?.plan_active) {
    return 'account'
  }

  return account.features.includes('overview') ? 'overview' : 'rooms'
}

function AdminDashboard({
  rooms,
  reservations,
  room,
  setRoom,
  editingId,
  modalOpen,
  openCreateModal,
  openEditModal,
  saveRoom,
  deleteRoom,
  cancelReservation,
  registerCashPayment,
  setModalOpen,
  message,
  error,
  busy,
  logout,
  notificationProps,
  gql,
  onInvoiceIssued,
  account,
  catalog,
  refreshAccount,
  reloadAdminData,
}) {
  const [selectedTab, setTab] = useState(null)
  const [invoiceReservation, setInvoiceReservation] = useState(null)
  const tab = selectedTab || defaultTab(account)

  function lockFor(item) {
    if (!account || item.id === 'account') {
      return null
    }

    if (!account.plan_active) {
      return { inactive: true }
    }

    if (item.feature && !account.features.includes(item.feature)) {
      return { plan: planFor(item.feature, catalog?.plans) }
    }

    return null
  }

  function openAccount() {
    setTab('account')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // A tab's content, or the lock when the plan does not open it.
  function renderTab(id, content) {
    if (tab !== id) {
      return null
    }

    const item = TABS.find((entry) => entry.id === id)
    const lock = lockFor(item)

    if (lock) {
      return (
        <LockedModule
          title={item.label}
          plan={lock.plan}
          inactive={lock.inactive}
          onOpenAccount={openAccount}
        />
      )
    }

    return content()
  }

  const moduleProps = {
    gql,
    catalog,
    account,
    refreshAccount,
    onOpenAccount: openAccount,
  }

  const invoiceCost =
    catalog?.credit_features.find((feature) => feature.id === 'invoice')?.cost ?? 1

  return (
    <main className="simple-app">
      <header className="simple-nav">
        <strong className="brand">
          {account?.name || 'Mi hotel'}
          <small>Panel · {PLATFORM_NAME}</small>
        </strong>

        <div className="nav-actions">
          {account && (
            <>
              <button
                className={`plan-pill plan-${account.plan_active ? account.plan : 'none'}`}
                onClick={openAccount}
                title="Ver mi plan"
              >
                {account.plan_active ? account.plan_name : 'Plan vencido'}
              </button>

              <button className="credit-pill" onClick={openAccount} title="Ver mis créditos">
                {account.credits} créditos
              </button>
            </>
          )}

          <NotificationBell {...notificationProps} />

          <button
            className="simple-link"
            onClick={logout}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Secciones">
        {TABS.map((item) => {
          const locked = Boolean(lockFor(item))
          const passEnd = item.pass && passEndsAt(account, item.pass)

          return (
            <button
              key={item.id}
              className={`${tab === item.id ? 'active' : ''} ${locked ? 'locked' : ''}`}
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              {locked && (
                <span className="tab-badge" aria-label="Bloqueado">
                  bloqueado
                </span>
              )}
              {!locked && item.credits && <span className="tab-badge">créditos</span>}
              {!locked && item.pass && (
                <span className={`tab-badge ${passEnd ? 'on' : ''}`}>
                  {passEnd ? formatRemaining(passEnd) : 'pase'}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {message && (
        <div className="simple-message success">
          {message}
        </div>
      )}

      {error && (
        <div className="simple-message error">
          {error}
        </div>
      )}

      {account && !account.plan_active && (
        <div className="simple-message warning">
          La suscripción de tu hotel no está activa y tus huéspedes no pueden
          reservar. Activa o renueva tu plan en esta página.
        </div>
      )}

      {!account ? (
        <p className="simple-empty">Cargando tu hotel...</p>
      ) : (
        <>
          {renderTab('overview', () => <AdminOverview gql={gql} onOpenTab={setTab} />)}

          {renderTab('menu', () => <AdminMenu gql={gql} />)}

          {renderTab('staff', () => <AdminStaff gql={gql} />)}

          {renderTab('invoices', () => (
            <>
              <InvoiceList gql={gql} isAdmin onChanged={onInvoiceIssued} />
              <p className="module-note">
                Cada factura timbrada cuesta {invoiceCost}{' '}
                {invoiceCost === 1 ? 'crédito' : 'créditos'}, que se descuenta cuando
                el huésped factura su estancia. Saldo: {account.credits} créditos.
              </p>
            </>
          ))}

          {renderTab('reports', () => <AdminReports {...moduleProps} />)}

          {renderTab('analytics', () => (
            <PassGate
              {...moduleProps}
              feature="analytics"
              title="Analítica avanzada"
              description="Ingresos de los últimos 12 meses, ocupación por habitación, tarifa promedio, cancelaciones y huéspedes que regresan."
            >
              <AdminAnalytics gql={gql} />
            </PassGate>
          ))}

          {renderTab('campaigns', () => (
            <PassGate
              {...moduleProps}
              feature="campaigns"
              title="Campañas a huéspedes"
              description="Envía avisos y promociones a los huéspedes que ya se hospedaron o que tienen una estancia próxima."
            >
              <AdminCampaigns gql={gql} />
            </PassGate>
          ))}

          {renderTab('account', () => (
            <AdminAccount
              gql={gql}
              account={account}
              catalog={catalog}
              refreshAccount={async () => {
                const updated = await refreshAccount()

                // Reactivating the plan opens the modules again.
                if (updated?.plan_active && !account.plan_active) {
                  await reloadAdminData()
                }
              }}
            />
          ))}

          {renderTab('rooms', () => (
            <>
              <section className="simple-heading">
                <div>
                  <h1>Habitaciones</h1>

                  <p>
                    {account.room_limit
                      ? `${rooms.length} de ${account.room_limit} habitaciones de tu plan ${account.plan_name}.`
                      : 'Administra las habitaciones de tu hotel.'}
                  </p>
                </div>

                <button
                  className="simple-button"
                  onClick={openCreateModal}
                >
                  Agregar habitación
                </button>
              </section>

              <section className="simple-table-card">
                <table>
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Tipo</th>
                      <th>Precio</th>
                      <th>Capacidad</th>
                      <th>Características</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rooms.length === 0 ? (
                      <tr>
                        <td
                          colSpan="7"
                          className="simple-empty"
                        >
                          No hay habitaciones registradas.
                        </td>
                      </tr>
                    ) : (
                      rooms.map((item) => (
                        <tr key={item.id}>
                          <td>{item.number}</td>

                          <td>{item.type}</td>

                          <td>${item.price}</td>

                          <td>{item.capacity}</td>

                          <td>
                            {Array.isArray(item.features) &&
                            item.features.length > 0
                              ? item.features.join(', ')
                              : 'Sin características'}
                          </td>

                          <td>
                            <span
                              className={`simple-status ${item.status}`}
                            >
                              {item.status}
                            </span>
                          </td>

                          <td>
                            <div className="simple-actions">
                              <button
                                className="simple-link"
                                onClick={() =>
                                  openEditModal(item)
                                }
                              >
                                Editar
                              </button>

                              <button
                                className="simple-danger"
                                onClick={() =>
                                  deleteRoom(item)
                                }
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </section>

              {modalOpen && (
                <RoomModal
                  room={room}
                  setRoom={setRoom}
                  editingId={editingId}
                  saveRoom={saveRoom}
                  close={() => setModalOpen(false)}
                  busy={busy}
                />
              )}

              <AdminReservations
                reservations={reservations}
                cancelReservation={cancelReservation}
                registerCashPayment={registerCashPayment}
                openInvoice={setInvoiceReservation}
                busy={busy}
              />
            </>
          ))}
        </>
      )}

      {invoiceReservation && (
        <InvoiceModal
          gql={gql}
          reservation={invoiceReservation}
          onClose={() => setInvoiceReservation(null)}
          onChanged={onInvoiceIssued}
        />
      )}
    </main>
  )
}

export default AdminDashboard
