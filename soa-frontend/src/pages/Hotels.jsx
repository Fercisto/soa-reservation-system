import { useEffect, useState } from 'react'
import HotelCard from '../components/HotelCard.jsx'
import PublicNav from '../components/PublicNav.jsx'
import { graphqlRequest } from '../services/api.js'
import { PLATFORM_NAME } from '../utils/brand.js'

const SORTS = {
  name: (a, b) => a.name.localeCompare(b.name, 'es'),
  price: (a, b) => (a.min_price ?? Infinity) - (b.min_price ?? Infinity),
  rooms: (a, b) => b.rooms_count - a.rooms_count,
}

// Accent-insensitive search, so "leon" finds "León".
function normalize(text) {
  return (text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * Every hotel guests can book, with search by name or city.
 */
function Hotels() {
  const [hotels, setHotels] = useState([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [city, setCity] = useState('')
  const [onlyRestaurant, setOnlyRestaurant] = useState(false)
  const [sort, setSort] = useState('name')

  useEffect(() => {
    graphqlRequest(`
      query Hotels {
        hotels { id name slug city description rooms_count min_price has_restaurant }
      }
    `)
      .then((data) => setHotels(data.hotels))
      .catch((err) => setError(err.message))
      .finally(() => setReady(true))
  }, [])

  const cities = [...new Set(hotels.map((hotel) => hotel.city).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, 'es')
  )
  const query = normalize(search.trim())
  const visible = hotels
    .filter((hotel) => !city || hotel.city === city)
    .filter((hotel) => !onlyRestaurant || hotel.has_restaurant)
    .filter(
      (hotel) =>
        !query ||
        normalize(`${hotel.name} ${hotel.city} ${hotel.description}`).includes(query)
    )
    .sort(SORTS[sort])

  return (
    <main className="landing">
      <PublicNav current="hotels" />

      <section className="landing-section hotels-page">
        <div className="hotels-heading">
          <h1>Hoteles</h1>
          <p>
            Todos los hoteles disponibles en {PLATFORM_NAME}. Elige uno para ver
            sus habitaciones y reservar.
          </p>
        </div>

        <div className="hotel-filters">
          <label className="hotel-search">
            Buscar
            <input
              type="search"
              placeholder="Nombre del hotel o ciudad"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label>
            Ciudad
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">Todas</option>
              {cities.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            Ordenar por
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="name">Nombre</option>
              <option value="price">Precio más bajo</option>
              <option value="rooms">Más habitaciones</option>
            </select>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={onlyRestaurant}
              onChange={(event) => setOnlyRestaurant(event.target.checked)}
            />
            Con restaurante
          </label>
        </div>

        {error && <div className="simple-message error">{error}</div>}

        {ready && !error && (
          <p className="hotels-count">
            {visible.length === hotels.length
              ? `${hotels.length} ${hotels.length === 1 ? 'hotel' : 'hoteles'}`
              : `${visible.length} de ${hotels.length} hoteles`}
          </p>
        )}

        {!ready ? (
          <p className="simple-empty">Cargando hoteles...</p>
        ) : visible.length === 0 ? (
          <p className="simple-empty">
            {hotels.length === 0
              ? 'Aún no hay hoteles disponibles.'
              : 'Ningún hotel coincide con tu búsqueda.'}
          </p>
        ) : (
          <div className="hotel-cards">
            {visible.map((hotel) => (
              <HotelCard key={hotel.id} hotel={hotel} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default Hotels
