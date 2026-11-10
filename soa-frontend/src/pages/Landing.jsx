import { useEffect, useState } from 'react'
import { graphqlRequest } from '../services/api.js'
import { PLATFORM_NAME } from '../utils/brand.js'
import { money } from '../utils/reservation.js'
import { linkProps, navigate } from '../utils/router.js'
import HotelCard from '../components/HotelCard.jsx'
import PublicNav from '../components/PublicNav.jsx'
import { CATALOG_QUERY, PASS_UNITS, PLAN_FEATURES } from '../utils/saas.js'

// The home page shows a few hotels; /hoteles lists all of them.
const HOME_HOTELS = 6

const PLAN_TAGLINES = {
  bronze: 'Para empezar a recibir reservaciones en línea.',
  silver: 'Para operar con indicadores y control de personal.',
  gold: 'Todo el hotel, incluido el restaurante.',
}

/**
 * Public home page of the platform: plans for hotels and the hotels guests can book.
 */
function Landing() {
  const [catalog, setCatalog] = useState(null)
  const [hotels, setHotels] = useState([])
  const [selected, setSelected] = useState('gold')
  const [error, setError] = useState('')

  useEffect(() => {
    graphqlRequest(`
      query Home {
        ${CATALOG_QUERY}
        hotels { id name slug city description rooms_count min_price has_restaurant }
      }
    `)
      .then((data) => {
        setCatalog(data.platformCatalog)
        setHotels(data.hotels)
      })
      .catch((err) => setError(err.message))
  }, [])

  const plans = catalog?.plans || []
  const selectedPlan = plans.find((plan) => plan.id === selected)

  return (
    <main className="landing">
      <PublicNav />

      <section className="landing-hero">
        <h1>Tu hotel en línea, sin complicaciones.</h1>
        <p>
          Reservaciones, pagos con tarjeta, facturación CFDI, personal y
          restaurante en una sola plataforma. Elige tu plan y empieza hoy.
        </p>
        <div className="landing-hero-actions">
          <a className="simple-button" href="#planes">
            Ver planes
          </a>
          <a className="simple-link" {...linkProps('/hoteles')}>
            Buscar un hotel para hospedarme
          </a>
        </div>
      </section>

      {error && <div className="simple-message error">{error}</div>}

      <section id="planes" className="landing-section">
        <div className="landing-section-heading">
          <h2>Elige el plan para tu hotel</h2>
          <p>
            Pago mensual ({catalog?.period_days || 30} días). Cambia de plan o
            renueva cuando quieras.
          </p>
        </div>

        <div className="plan-cards" role="radiogroup" aria-label="Planes">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              role="radio"
              aria-checked={selected === plan.id}
              className={`plan-card plan-${plan.id} ${
                selected === plan.id ? 'selected' : ''
              }`}
              onClick={() => setSelected(plan.id)}
            >
              <span className="plan-name">{plan.name}</span>
              <strong>
                {money(plan.price)}
                <small> /mes</small>
              </strong>
              <span className="plan-tagline">{PLAN_TAGLINES[plan.id]}</span>
              <span className="plan-limit">
                {plan.room_limit
                  ? `Hasta ${plan.room_limit} habitaciones`
                  : 'Habitaciones ilimitadas'}
              </span>
              {plan.monthly_credits > 0 && (
                <span className="plan-bonus">
                  +{plan.monthly_credits} créditos cada mes
                </span>
              )}
            </button>
          ))}
        </div>

        {plans.length > 0 && (
          <div className="plan-compare">
            <table>
              <thead>
                <tr>
                  <th>Módulo</th>
                  {plans.map((plan) => (
                    <th
                      key={plan.id}
                      className={selected === plan.id ? 'selected' : ''}
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLAN_FEATURES.map((feature) => (
                  <tr key={feature.id}>
                    <td>{feature.label}</td>
                    {plans.map((plan) => (
                      <td
                        key={plan.id}
                        className={selected === plan.id ? 'selected' : ''}
                      >
                        {plan.features.includes(feature.id) ? (
                          <span className="check" aria-label="Incluido">
                            ✓
                          </span>
                        ) : (
                          <span className="dash" aria-label="No incluido">
                            —
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td>Facturación, reportes, analítica y campañas</td>
                  {plans.map((plan) => (
                    <td
                      key={plan.id}
                      className={selected === plan.id ? 'selected' : ''}
                    >
                      Con créditos
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>

            <button
              className="simple-button plan-continue"
              onClick={() => navigate(`/registrar-hotel?plan=${selected}`)}
            >
              Continuar con {selectedPlan?.name}
            </button>
          </div>
        )}
      </section>

      {catalog && (
        <section className="landing-section">
          <div className="landing-section-heading">
            <h2>Funciones especiales con créditos</h2>
            <p>
              Compra créditos y úsalos solo cuando los necesites, con
              cualquier plan.
            </p>
          </div>

          <div className="credit-explainer">
            <article>
              <h3>Pago por uso</h3>
              <ul>
                {catalog.credit_features.map((feature) => (
                  <li key={feature.id}>
                    <span>{feature.name}</span>
                    <b>
                      {feature.cost} {feature.cost === 1 ? 'crédito' : 'créditos'} por{' '}
                      {feature.unit}
                    </b>
                  </li>
                ))}
              </ul>
            </article>

            <article>
              <h3>Acceso por tiempo</h3>
              <ul>
                {catalog.passes.map((pass) => (
                  <li key={pass.id}>
                    <span>{pass.name}</span>
                    <b>
                      {PASS_UNITS.map((unit) =>
                        unit.id === 'minutes'
                          ? `${pass.rates.minutes} cr / ${catalog.minutes_block} min`
                          : `${pass.rates[unit.id]} cr / ${unit.singular}`
                      ).join(' · ')}
                    </b>
                  </li>
                ))}
              </ul>
            </article>

            <article>
              <h3>Paquetes de créditos</h3>
              <ul>
                {catalog.credit_packages.map((pkg) => (
                  <li key={pkg.id}>
                    <span>
                      {pkg.name}: {pkg.credits} créditos
                    </span>
                    <b>{money(pkg.price)}</b>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>
      )}

      <section id="hoteles" className="landing-section">
        <div className="landing-section-heading">
          <h2>Hoteles en {PLATFORM_NAME}</h2>
          <p>Elige un hotel para ver sus habitaciones y reservar.</p>
        </div>

        {hotels.length === 0 ? (
          <p className="simple-empty">Aún no hay hoteles disponibles.</p>
        ) : (
          <>
            <div className="hotel-cards">
              {hotels.slice(0, HOME_HOTELS).map((hotel) => (
                <HotelCard key={hotel.id} hotel={hotel} />
              ))}
            </div>

            <a className="simple-button see-all" {...linkProps('/hoteles')}>
              {hotels.length > HOME_HOTELS
                ? `Ver los ${hotels.length} hoteles`
                : 'Ver todos los hoteles'}
            </a>
          </>
        )}
      </section>

      <footer className="landing-footer">
        {PLATFORM_NAME} · Plataforma de gestión hotelera
      </footer>
    </main>
  )
}

export default Landing
