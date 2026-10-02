import {
  reservationNights,
  money,
} from '../utils/reservation.js'

function CustomerDashboard({
  rooms,
  reservations,
  booking,
  setBooking,
  createReservation,
  cancelReservation,
  message,
  error,
  busy,
  ready,
  logout,
}) {
  const currentDate = new Date()
  const today = [
    currentDate.getFullYear(),
    String(currentDate.getMonth() + 1).padStart(2, '0'),
    String(currentDate.getDate()).padStart(2, '0'),
  ].join('-')

  return (
    <main className="customer-app">
      <header className="simple-nav">
        <strong>Reservaciones</strong>

        <button
          className="simple-link"
          onClick={logout}
        >
          Cerrar sesión
        </button>
      </header>

      <section className="customer-heading">
        <h1>Habitaciones disponibles</h1>

        <p>
          Elige una habitación y reserva tus fechas.
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
              No hay habitaciones disponibles.
            </div>
          ) : (
            rooms.map((item) => (
              <article
                className="customer-room"
                key={item.id}
              >
                <div>
                  <span className="simple-status available">
                    Disponible
                  </span>

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
                  onClick={() =>
                    setBooking({
                      ...booking,
                      room_id: item.id,
                    })
                  }
                >
                  Reservar esta habitación
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
                  Habitación {item.number} - ${item.price}
                </option>
              ))}
            </select>
          </label>

          <label>
            Entrada

            <input
              required
              type="date"
              min={today}
              value={booking.check_in}
              onChange={(event) =>
                setBooking({
                  ...booking,
                  check_in: event.target.value,
                })
              }
            />
          </label>

          <label>
            Salida

            <input
              required
              type="date"
              min={booking.check_in || today}
              value={booking.check_out}
              onChange={(event) =>
                setBooking({
                  ...booking,
                  check_out: event.target.value,
                })
              }
            />
          </label>

          <button
            className="simple-button"
            disabled={busy}
          >
            {busy
              ? 'Reservando...'
              : 'Confirmar reservación'}
          </button>
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
                    className={`simple-status ${
                      item.status === 'confirmed'
                        ? 'available'
                        : 'inactive'
                    }`}
                  >
                    {item.status}
                  </span>

                  {item.status !== 'cancelled' && (
                    <button
                      className="simple-danger"
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
