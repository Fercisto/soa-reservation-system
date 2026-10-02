function AdminReservations({ reservations }) {
  const activeReservations = reservations.filter(
    (reservation) => reservation.status !== 'cancelled'
  )

  return (
    <section className="admin-reservations">
      <div className="admin-reservations-heading">
        <div>
          <h2>Reservaciones activas</h2>
          <p>
            Reservaciones confirmadas realizadas por los clientes.
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

                <b className="simple-status confirmed">
                  {reservation.status}
                </b>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default AdminReservations