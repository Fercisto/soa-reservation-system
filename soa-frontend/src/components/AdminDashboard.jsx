import { useState } from 'react'
import NotificationBell from './NotificationBell.jsx'
import RoomModal from './RoomModal.jsx'
import AdminReservations from './AdminReservations.jsx'
import AdminMenu from './AdminMenu.jsx'
import AdminStaff from './AdminStaff.jsx'
import InvoiceList from './InvoiceList.jsx'
import AdminOverview from './AdminOverview.jsx'
import InvoiceModal from './InvoiceModal.jsx'
import { HOTEL_NAME } from '../utils/brand.js'

const TABS = [
  { id: 'overview', label: 'Resumen' },
  { id: 'rooms', label: 'Habitaciones' },
  { id: 'menu', label: 'Menú' },
  { id: 'staff', label: 'Personal' },
  { id: 'invoices', label: 'Facturas' },
]

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
}) {
  const [tab, setTab] = useState('overview')
  const [invoiceReservation, setInvoiceReservation] = useState(null)

  return (
    <main className="simple-app">
      <header className="simple-nav">
        <strong className="brand">
          {HOTEL_NAME}
          <small>Administración</small>
        </strong>

        <div className="nav-actions">
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

      {tab === 'overview' && <AdminOverview gql={gql} onOpenTab={setTab} />}

      {tab === 'menu' && <AdminMenu gql={gql} />}

      {tab === 'staff' && <AdminStaff gql={gql} />}

      {tab === 'invoices' && <InvoiceList gql={gql} isAdmin onChanged={onInvoiceIssued} />}

      {tab === 'rooms' && (
        <>
          <section className="simple-heading">
            <div>
              <h1>Habitaciones</h1>

              <p>
                Administra las habitaciones disponibles en el sistema.
              </p>
            </div>

            <button
              className="simple-button"
              onClick={openCreateModal}
            >
              Agregar habitación
            </button>
          </section>

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