import NotificationBell from './NotificationBell.jsx'
import {
  reservationNights,
  money,
  reservationStatus,
  paymentStatusLabel,
  isPaymentWindowOpen,
  formatTime,
} from '../utils/reservation.js'

function nextDay(date) {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)

  return next.toISOString().slice(0, 10)
}

function CustomerDashboard({
  rooms,
  reservations,
  booking,
  setBooking,
  createReservation,
  payReservation,
  cancelReservation,
  message,
  error,
  busy,
  ready,
  logout,
  notificationProps,
}) {
  const currentDate = new Date()
  const today = [
    currentDate.getFullYear(),
    String(currentDate.getMonth() + 1).padStart(2, '0'),
    String(currentDate.getDate()).padStart(2, '0'),
  ].join('-')

  const selectedRoom = rooms.find(
    (item) => String(item.id) === String(booking.room_id)
  )
  const bookingNights =
    booking.check_in && booking.check_out
      ? reservationNights(booking.check_in, booking.check_out)
      : 0
  const hasDates = bookingNights > 0

  return (
    <main className="customer-app">
      <header className="simple-nav">
        <strong>Reservaciones</strong>

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

      <section className="customer-heading">
        <h1>Habitaciones disponibles</h1>

        <p>
          {hasDates
            ? `Del ${booking.check_in} al ${booking.check_out} · ${
                rooms.length
              } ${rooms.length === 1 ? 'habitación libre' : 'habitaciones libres'}`
            : 'Elige tus fechas de entrada y salida para ver qué habitaciones están libres.'}
        </p>
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

      <section className="customer-layout">
        <div className="customer-rooms">
          {!ready ? (
            <div className="simple-empty">
              Cargando habitaciones y reservaciones...
            </div>
          ) : rooms.length === 0 ? (
            <div className="simple-empty">
              {hasDates
                ? 'No hay habitaciones libres para esas fechas. Prueba con otras.'
                : 'No hay habitaciones disponibles.'}
            </div>
          ) : (
            rooms.map((item) => (
              <article
                className="customer-room"
                key={item.id}
              >
                <div>
                  {hasDates && (
                    <span className="simple-status available">
                      Disponible
                    </span>
                  )}

                  <span className="customer-number">
                    Habitación {item.number}
                  </span>
                </div>

                <h2>{item.type}</h2>

                <p>
                  {item.description ||
                    'Una habitación cómoda para tu próxima estadía.'}
                </p>

                <strong className="customer-price">
                  ${item.price}

                  <small> / noche</small>
                </strong>

                <div className="customer-details">
                  <span>
                    Capacidad: {item.capacity}
                  </span>

                  <span>
                    {item.features?.length
                      ? item.features.join(', ')
                      : 'Sin características adicionales'}
                  </span>
                </div>

                <button
                  className="simple-button"
                  disabled={!hasDates}
                  onClick={() =>
                    setBooking({
                      ...booking,
                      room_id: item.id,
                    })
                  }
                >
                  {!hasDates
                    ? 'Elige tus fechas primero'
                    : String(item.id) === String(booking.room_id)
                      ? 'Seleccionada'
                      : 'Reservar esta habitación'}
                </button>
              </article>
            ))
          )}
        </div>

        <form
          className="booking-card"
          onSubmit={createReservation}
        >
          <h2>Nueva reservación</h2>

          <label>
            Entrada

            <input
              required
              type="date"
              min={today}
              value={booking.check_in}
              onChange={(event) => {
                const checkIn = event.target.value

                setBooking({
                  ...booking,
                  check_in: checkIn,
                  // A check-out on or before the new check-in is no longer valid.
                  check_out:
                    booking.check_out && booking.check_out > checkIn
                      ? booking.check_out
                      : '',
                })
              }}
            />
          </label>

          <label>
            Salida

            <input
              required
              type="date"
              disabled={!booking.check_in}
              min={booking.check_in ? nextDay(booking.check_in) : today}
              value={booking.check_out}
              onChange={(event) =>
                setBooking({
                  ...booking,
                  check_out: event.target.value,
                })
              }
            />
          </label>

          {!hasDates ? (
            <p className="booking-hint">
              Elige tus fechas para ver las habitaciones libres.
            </p>
          ) : rooms.length === 0 ? (
            <p className="booking-hint">
              No hay habitaciones libres en esas fechas.
            </p>
          ) : (
            <label>
              Habitación

              <select
                required
                value={booking.room_id}
                onChange={(event) =>
                  setBooking({
                    ...booking,
                    room_id: event.target.value,
                  })
                }
              >
                <option value="">
                  Selecciona una habitación
                </option>

                {rooms.map((item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    Habitación {item.number} · {item.type} ·{' '}
                    {money(item.price)} / noche
                  </option>
                ))}
              </select>
            </label>
          )}

          {selectedRoom && bookingNights > 0 && (
            <p className="booking-total">
              {bookingNights} noches × {money(selectedRoom.price)}
              <strong>
                Total: {money(selectedRoom.price * bookingNights)}
              </strong>
            </p>
          )}

          <button
            className="simple-button"
            disabled={busy || !hasDates || !selectedRoom}
          >
            {busy
              ? 'Procesando...'
              : 'Reservar y pagar'}
          </button>

          <small className="booking-note">
            Serás redirigido a Stripe para pagar con tarjeta. Las fechas
            se apartan mientras completas el pago.
          </small>
        </form>
      </section>

      <section className="customer-history">
        <h2>Mis reservaciones</h2>

        {reservations.length === 0 ? (
          <p>No tienes reservaciones todavía.</p>
        ) : (
          reservations.map((item) => {
            const nights = reservationNights(
              item.check_in,
              item.check_out
            )

            const price = Number(
              item.room?.price || 0
            )

            const status = reservationStatus(item)
            const canPay = isPaymentWindowOpen(item)
            const isActive =
              item.status === 'confirmed' || canPay

            return (
              <article key={item.id}>
                <div>
                  <strong>
                    Habitación{' '}
                    {item.room?.number || item.room_id}
                  </strong>

                  <span>
                    {item.check_in} al {item.check_out}
                  </span>

                  <span>
                    {nights} noches
                    {' · '}
                    {money(price)} por noche
                  </span>

                  <strong className="customer-total">
                    Total: {money(price * nights)}
                  </strong>
                </div>

                <div>
                  <span
                    className={`simple-status ${status.tone}`}
                  >
                    {status.label}
                  </span>

                  <span className="payment-status">
                    {paymentStatusLabel(item.latest_payment)}
                  </span>

                  {canPay && item.expires_at && (
                    <small>
                      Paga antes de las{' '}
                      {formatTime(item.expires_at)}
                    </small>
                  )}

                  {canPay && (
                    <button
                      className="simple-button"
                      disabled={busy}
                      onClick={() => payReservation(item)}
                    >
                      Pagar ahora
                    </button>
                  )}

                  {isActive && (
                    <button
                      className="simple-danger"
                      disabled={busy}
                      onClick={() =>
                        cancelReservation(item.id)
                      }
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </article>
            )
          })
        )}
      </section>
    </main>
  )
}

export default CustomerDashboard
