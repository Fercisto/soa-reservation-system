import { useEffect, useState } from 'react'
import { graphqlRequest } from '../services/api.js'
import { PLATFORM_NAME } from '../utils/brand.js'
import { money } from '../utils/reservation.js'
import { linkProps, navigate } from '../utils/router.js'
import { saveSession } from '../utils/session.js'

const EMPTY_FORM = {
  hotel_name: '',
  city: '',
  description: '',
  name: '',
  email: '',
  password: '',
  password_confirmation: '',
}

/**
 * Sign-up of a hotel and its first admin. Then the admin pays the plan in Stripe.
 */
function HotelSignup() {
  const [plans, setPlans] = useState([])
  const [plan, setPlan] = useState(
    () => new URLSearchParams(window.location.search).get('plan') || 'silver'
  )
  const [form, setForm] = useState(EMPTY_FORM)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    graphqlRequest(`query Plans { platformCatalog { plans { id name price room_limit } } }`)
      .then((data) => setPlans(data.platformCatalog.plans))
      .catch((err) => setError(err.message))
  }, [])

  function update(field) {
    return (event) => setForm({ ...form, [field]: event.target.value })
  }

  async function submit(event) {
    event.preventDefault()

    if (form.password !== form.password_confirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setBusy(true)
    setError('')

    try {
      const data = await graphqlRequest(
        `
        mutation RegisterHotel($input: RegisterHotelInput!) {
          registerHotel(input: $input) {
            token
            user
            payment { id checkout_url }
            payment_error
          }
        }
      `,
        { input: { ...form, plan } }
      )

      const result = data.registerHotel
      saveSession({ token: result.token, user: result.user })

      if (result.payment?.checkout_url) {
        window.location.assign(result.payment.checkout_url)
        return
      }

      // The hotel exists; the plan can be paid from the panel.
      navigate('/panel')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const selected = plans.find((item) => item.id === plan)

  return (
    <main className="simple-login signup-page">
      <form className="login-card signup-card" onSubmit={submit}>
        <a className="login-brand" {...linkProps('/')}>
          {PLATFORM_NAME}
        </a>

        <h1>Registra tu hotel</h1>
        <p>Crea la cuenta de tu hotel y paga tu primer mes con tarjeta.</p>

        <div className="signup-plans" role="radiogroup" aria-label="Plan">
          {plans.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={plan === item.id}
              className={`plan-chip plan-${item.id} ${plan === item.id ? 'selected' : ''}`}
              onClick={() => setPlan(item.id)}
            >
              <b>{item.name}</b>
              <span>{money(item.price)}/mes</span>
            </button>
          ))}
        </div>

        <fieldset>
          <legend>Tu hotel</legend>

          <label>
            Nombre del hotel
            <input required maxLength={120} value={form.hotel_name} onChange={update('hotel_name')} />
          </label>

          <label>
            Ciudad
            <input required maxLength={120} value={form.city} onChange={update('city')} />
          </label>

          <label>
            Descripción (opcional)
            <input maxLength={500} value={form.description} onChange={update('description')} />
          </label>
        </fieldset>

        <fieldset>
          <legend>Administrador</legend>

          <label>
            Tu nombre
            <input required maxLength={255} value={form.name} onChange={update('name')} />
          </label>

          <label>
            Correo
            <input required type="email" value={form.email} onChange={update('email')} />
          </label>

          <label>
            Contraseña
            <input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={update('password')}
            />
          </label>

          <label>
            Confirmar contraseña
            <input
              required
              type="password"
              minLength={8}
              value={form.password_confirmation}
              onChange={update('password_confirmation')}
            />
          </label>
        </fieldset>

        {error && <div className="simple-message error">{error}</div>}

        <button className="simple-button" disabled={busy || !selected}>
          {busy
            ? 'Creando tu hotel...'
            : `Pagar plan ${selected?.name || ''} · ${money(selected?.price)}`}
        </button>

        <p className="auth-switch">
          ¿Ya tienes cuenta? <a {...linkProps('/login')}>Inicia sesión</a>
        </p>
      </form>
    </main>
  )
}

export default HotelSignup
