import { useEffect, useState } from 'react'
import { PassPurchase } from './PassGate.jsx'
import { money } from '../utils/reservation.js'
import {
  PLAN_FEATURES,
  formatDate,
  formatDateTime,
  formatRemaining,
  passEndsAt,
  transactionTypeLabel,
} from '../utils/saas.js'

const PAYMENT_STATUS = {
  pending: 'Pendiente',
  paid: 'Pagado',
  failed: 'No completado',
  refunded: 'Reembolsado',
}

/**
 * The hotel's account with the platform: subscription, credits, time passes,
 * the credit ledger, payments to the platform and the hotel's settings.
 */
function AdminAccount({ gql, account, catalog, refreshAccount }) {
  const [history, setHistory] = useState({ transactions: [], payments: [] })
  const [settings, setSettings] = useState(null)
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [buyingPass, setBuyingPass] = useState(null)

  useEffect(() => {
    loadHistory()
  }, [account?.credits, account?.plan_expires_at])

  async function loadHistory() {
    try {
      const data = await gql(`
        query AccountHistory {
          creditTransactions { id type feature amount balance_after description created_at user { id name } }
          billingPayments { id purpose metadata amount status description paid_at created_at }
          myHotel { id name city description restaurant_configured rooms_used room_limit }
        }
      `)

      setHistory({ transactions: data.creditTransactions, payments: data.billingPayments })
      setSettings((current) =>
        current || {
          name: data.myHotel.name,
          city: data.myHotel.city || '',
          description: data.myHotel.description || '',
          restaurant_api_key: '',
          restaurant_configured: data.myHotel.restaurant_configured,
          rooms_used: data.myHotel.rooms_used,
        }
      )
    } catch (err) {
      setError(err.message)
    }
  }

  // Plans and credit packages are paid in Stripe; the panel verifies the payment on return.
  async function checkout(kind, id) {
    setBusy(`${kind}:${id}`)
    setError('')

    try {
      const data =
        kind === 'plan'
          ? await gql(`mutation Subscribe($plan: String!) { subscribe(plan: $plan) { checkout_url } }`, { plan: id })
          : await gql(`mutation BuyCredits($package: String!) { buyCredits(package: $package) { checkout_url } }`, { package: id })
      const url = (data.subscribe || data.buyCredits).checkout_url

      if (!url) {
        throw new Error('No se pudo iniciar el pago.')
      }

      window.location.assign(url)
    } catch (err) {
      setError(err.message)
      setBusy('')
    }
  }

  async function saveSettings(event) {
    event.preventDefault()
    setBusy('settings')
    setError('')
    setMessage('')

    const input = {
      name: settings.name,
      city: settings.city,
      description: settings.description,
    }

    // An empty field keeps the saved key.
    if (settings.restaurant_api_key.trim()) {
      input.restaurant_api_key = settings.restaurant_api_key.trim()
    }

    try {
      const data = await gql(
        `mutation UpdateMyHotel($input: UpdateHotelInput!) {
          updateMyHotel(input: $input) { id name restaurant_configured }
        }`,
        { input }
      )

      setSettings({
        ...settings,
        restaurant_api_key: '',
        restaurant_configured: data.updateMyHotel.restaurant_configured,
      })
      setMessage('Datos del hotel guardados.')
      await refreshAccount()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function removeRestaurantKey() {
    setBusy('settings')
    setError('')

    try {
      await gql(
        `mutation RemoveRestaurantKey($input: UpdateHotelInput!) {
          updateMyHotel(input: $input) { id }
        }`,
        {
          input: {
            name: settings.name,
            city: settings.city,
            description: settings.description,
            restaurant_api_key: '',
          },
        }
      )

      setSettings({ ...settings, restaurant_configured: false })
      setMessage('Se quitó la clave del sistema del restaurante.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  if (!account || !catalog) {
    return <p className="simple-empty">Cargando tu plan...</p>
  }

  return (
    <>
      <section className="simple-heading">
        <div>
          <h1>Mi plan</h1>
          <p>Suscripción, créditos y pases de {account.name}.</p>
        </div>
      </section>

      {message && <div className="simple-message success">{message}</div>}
      {error && <div className="simple-message error">{error}</div>}

      <section className="account-summary">
        <article className={`account-plan plan-${account.plan || 'none'}`}>
          <span>Plan actual</span>
          <strong>{account.plan_name || 'Sin plan'}</strong>
          <small>
            {account.plan_active
              ? `Activo hasta el ${formatDate(account.plan_expires_at)}`
              : account.plan
                ? `Venció el ${formatDate(account.plan_expires_at)}`
                : 'Elige un plan para activar tu hotel'}
          </small>
          {settings && (
            <small>
              {settings.rooms_used} de{' '}
              {account.room_limit ?? 'habitaciones ilimitadas'}
              {account.room_limit ? ' habitaciones' : ''}
            </small>
          )}
        </article>

        <article className="account-credits">
          <span>Créditos disponibles</span>
          <strong>{account.credits}</strong>
          <small>Se usan en facturación, reportes y pases por tiempo.</small>
        </article>
      </section>

      <section className="account-section">
        <h2>{account.plan_active ? 'Renovar o cambiar de plan' : 'Activa tu plan'}</h2>
        <p className="account-note">
          Renovar el mismo plan suma {catalog.period_days} días a tu vencimiento. Un
          plan diferente empieza hoy.
        </p>

        <div className="plan-cards compact">
          {catalog.plans.map((plan) => {
            const current = plan.id === account.plan

            return (
              <article
                key={plan.id}
                className={`plan-card plan-${plan.id} ${current ? 'selected' : ''}`}
              >
                <span className="plan-name">{plan.name}</span>
                <strong>
                  {money(plan.price)}
                  <small> /mes</small>
                </strong>
                <ul className="plan-features">
                  {PLAN_FEATURES.filter((feature) => plan.features.includes(feature.id)).map(
                    (feature) => (
                      <li key={feature.id}>{feature.label}</li>
                    )
                  )}
                  <li>
                    {plan.room_limit
                      ? `Hasta ${plan.room_limit} habitaciones`
                      : 'Habitaciones ilimitadas'}
                  </li>
                  {plan.monthly_credits > 0 && (
                    <li>+{plan.monthly_credits} créditos por periodo</li>
                  )}
                </ul>
                <button
                  className={current ? 'simple-button' : 'simple-button secondary'}
                  disabled={busy !== ''}
                  onClick={() => checkout('plan', plan.id)}
                >
                  {busy === `plan:${plan.id}`
                    ? 'Abriendo pago...'
                    : current && account.plan_active
                      ? 'Renovar'
                      : current
                        ? 'Reactivar'
                        : `Cambiar a ${plan.name}`}
                </button>
              </article>
            )
          })}
        </div>
      </section>

      <section className="account-section">
        <h2>Comprar créditos</h2>
        <p className="account-note">
          {catalog.credit_features
            .map((feature) => `${feature.name}: ${feature.cost} por ${feature.unit}`)
            .join(' · ')}
        </p>

        <div className="credit-packages">
          {catalog.credit_packages.map((pkg) => (
            <article key={pkg.id}>
              <span>{pkg.name}</span>
              <strong>{pkg.credits} créditos</strong>
              <small>
                {money(pkg.price)} · {money(pkg.price / pkg.credits)} por crédito
              </small>
              <button
                className="simple-button"
                disabled={busy !== ''}
                onClick={() => checkout('credits', pkg.id)}
              >
                {busy === `credits:${pkg.id}` ? 'Abriendo pago...' : 'Comprar'}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="account-section">
        <h2>Pases por tiempo</h2>

        <div className="pass-list">
          {catalog.passes.map((pass) => {
            const end = passEndsAt(account, pass.id)

            return (
              <article key={pass.id}>
                <div>
                  <strong>{pass.name}</strong>
                  <span className={end ? 'pass-on' : 'pass-off'}>
                    {end
                      ? `Activo hasta ${formatDateTime(end)} (quedan ${formatRemaining(end)})`
                      : 'Sin acceso'}
                  </span>
                </div>

                {account.plan_active && (
                  <button
                    className="simple-link"
                    onClick={() => setBuyingPass(buyingPass === pass.id ? null : pass.id)}
                  >
                    {buyingPass === pass.id ? 'Cerrar' : end ? 'Extender' : 'Comprar pase'}
                  </button>
                )}

                {buyingPass === pass.id && (
                  <PassPurchase
                    gql={gql}
                    catalog={catalog}
                    account={account}
                    feature={pass.id}
                    onBought={async () => {
                      await refreshAccount()
                      setBuyingPass(null)
                      setMessage(`Pase de ${pass.name} comprado.`)
                    }}
                    onOpenAccount={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  />
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section className="account-section">
        <h2>Movimientos de créditos</h2>

        <div className="simple-table-card">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Concepto</th>
                <th>Usuario</th>
                <th className="num">Créditos</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {history.transactions.length === 0 ? (
                <tr>
                  <td colSpan="6" className="simple-empty">
                    Todavía no hay movimientos.
                  </td>
                </tr>
              ) : (
                history.transactions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.created_at)}</td>
                    <td>{transactionTypeLabel(item.type)}</td>
                    <td>{item.description}</td>
                    <td>{item.user?.name || 'Sistema'}</td>
                    <td className={`num ${item.amount < 0 ? 'credit-out' : 'credit-in'}`}>
                      {item.amount > 0 ? `+${item.amount}` : item.amount}
                    </td>
                    <td className="num">{item.balance_after}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="account-section">
        <h2>Pagos a la plataforma</h2>

        <div className="simple-table-card">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Concepto</th>
                <th className="num">Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {history.payments.length === 0 ? (
                <tr>
                  <td colSpan="4" className="simple-empty">
                    Todavía no hay pagos.
                  </td>
                </tr>
              ) : (
                history.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDateTime(payment.paid_at || payment.created_at)}</td>
                    <td>
                      {payment.description}
                      {payment.metadata?.period_end && (
                        <span className="cell-note">
                          Periodo del {formatDate(payment.metadata.period_start)} al{' '}
                          {formatDate(payment.metadata.period_end)}
                        </span>
                      )}
                    </td>
                    <td className="num">{money(payment.amount)}</td>
                    <td>
                      <span
                        className={`simple-status ${
                          payment.status === 'paid' ? 'available' : 'inactive'
                        }`}
                      >
                        {PAYMENT_STATUS[payment.status] || payment.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {settings && (
        <section className="account-section">
          <h2>Datos del hotel</h2>

          <form className="settings-form" onSubmit={saveSettings}>
            <label>
              Nombre
              <input
                required
                maxLength={120}
                value={settings.name}
                onChange={(event) => setSettings({ ...settings, name: event.target.value })}
              />
            </label>

            <label>
              Ciudad
              <input
                required
                maxLength={120}
                value={settings.city}
                onChange={(event) => setSettings({ ...settings, city: event.target.value })}
              />
            </label>

            <label className="wide">
              Descripción para los huéspedes
              <input
                maxLength={500}
                value={settings.description}
                onChange={(event) =>
                  setSettings({ ...settings, description: event.target.value })
                }
              />
            </label>

            <label className="wide">
              API key del sistema del restaurante (menú y personal)
              <input
                type="password"
                autoComplete="off"
                placeholder={
                  settings.restaurant_configured
                    ? 'Guardada. Escribe una nueva para reemplazarla.'
                    : 'Pega la clave que te dio el sistema del restaurante'
                }
                value={settings.restaurant_api_key}
                onChange={(event) =>
                  setSettings({ ...settings, restaurant_api_key: event.target.value })
                }
              />
            </label>

            <div className="settings-actions wide">
              {settings.restaurant_configured && (
                <button
                  type="button"
                  className="simple-danger"
                  disabled={busy !== ''}
                  onClick={removeRestaurantKey}
                >
                  Quitar clave del restaurante
                </button>
              )}
              <button className="simple-button" disabled={busy !== ''}>
                {busy === 'settings' ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  )
}

export default AdminAccount
