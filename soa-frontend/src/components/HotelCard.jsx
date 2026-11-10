import { money } from '../utils/reservation.js'
import { linkProps } from '../utils/router.js'

function HotelCard({ hotel }) {
  return (
    <a className="hotel-card" {...linkProps(`/h/${hotel.slug}`)}>
      <span className="hotel-card-city">{hotel.city}</span>
      <h3>{hotel.name}</h3>
      <p>{hotel.description || 'Reserva tu estancia en línea.'}</p>
      <div>
        <span>
          {hotel.rooms_count}{' '}
          {hotel.rooms_count === 1 ? 'habitación' : 'habitaciones'}
        </span>
        {hotel.min_price !== null && (
          <b>Desde {money(hotel.min_price)} / noche</b>
        )}
      </div>
      {hotel.has_restaurant && (
        <span className="hotel-card-tag">Restaurante</span>
      )}
    </a>
  )
}

export default HotelCard
