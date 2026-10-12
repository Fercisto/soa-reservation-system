import {
  reservationStatus,
  paymentStatusLabel,
  isPaymentWindowOpen,
} from '../utils/reservation.js'

function AdminReservations({
  reservations,
  cancelReservation,
  registerCashPayment,
  busy,
}) {
  const activeReservations = reservations.filter(
    (reservation) =>
      reservation.status === 'confirmed' ||
      isPaymentWindowOpen(reservation)
  )

  return (
    <section className="admin-reservations">
      <div className="admin-reservations-heading">
        <div>
          <h2>Reservaciones activas</h2>
          <p>
            Reservaciones confirmadas y pendientes de pago.
          </p>
        </div>

        <strong>{activeReservations.length}</strong>
      </div>

      {activeReservations.length === 0 ? (
        <p className="simple-empty">
          No hay reservaciones activas.
        </p>
      ) : (
        <div className="admin-reservation-list">
          {activeReservations.map((reservation) => (
            <article key={reservation.id}>
              <div>
                <strong>
                  Habitación{' '}
                  {reservation.room?.number ||
                    reservation.room_id}
                </strong>

                <span>
                  {reservation.user?.name ||
                    reservation.user?.email ||
                    'Cliente'}
                </span>
              </div>

              <div>
                <span>
                  {reservation.check_in} al{' '}
                  {reservation.check_out}
                </span>

                <b
                  className={`simple-status ${
                    reservationStatus(reservation).tone
                  }`}
                >
                  {reservationStatus(reservation).label}
                </b>

                <span>
                  {paymentStatusLabel(reservation.latest_payment)}
                </span>

                {isPaymentWindowOpen(reservation) && (
                  <button
                    className="simple-link"
                    disabled={busy}
                    onClick={() =>
                      registerCashPayment(reservation)
                    }
                  >
                    Cobrar en efectivo
                  </button>
                )}

                <button
                  className="simple-danger"
                  disabled={busy}
                  onClick={() =>
                    cancelReservation(reservation.id)
                  }
                >
                  Cancelar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default AdminReservations