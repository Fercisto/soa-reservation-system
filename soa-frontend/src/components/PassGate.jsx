import { useEffect, useState } from 'react'
import {
  PASS_UNITS,
  formatDateTime,
  formatRemaining,
  passCost,
  passEndsAt,
  unitLabel,
} from '../utils/saas.js'

/**
 * Buy minutes, hours or days of a module with credits. Buying while a pass runs extends it.
 */
export function PassPurchase({ gql, catalog, account, feature, onBought, onOpenAccount }) {
  const [unit, setUnit] = useState('hours')
  const [quantity, setQuantity] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const limits = catalog?.pass_limits?.[unit] || { min: 1, max: 1 }
  const step = unit === 'minutes' ? catalog?.minutes_block || 15 : 1
  const cost = passCost(catalog, feature, unit, quantity)
  const missing = Math.max(0, cost - (account?.credits || 0))

  function changeUnit(nextUnit) {
    setUnit(nextUnit)
    setQuantity(catalog?.pass_limits?.[nextUnit]?.min || 1)
  }

  async function buy(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    try {
      await gql(
        `
        mutation BuyPass($input: BuyPassInput!) {
          buyPass(input: $input) { pass { id expires_at } }
        }
      `,
        { input: { feature, unit, quantity: Number(quantity) } }
      )

      await onBought?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="pass-purchase" onSubmit={buy}>
      <div className="pass-units" role="radiogroup" aria-label="Unidad de tiempo">
        {PASS_UNITS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={unit === item.id}
            className={unit === item.id ? 'active' : ''}
            onClick={() => changeUnit(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <label>
        Cantidad de {unitLabel(unit, 2)}
        <input
          type="number"
          required
          min={limits.min}
          max={limits.max}
          step={step}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </label>

      <p className="pass-cost">
        Costo: <strong>{cost} créditos</strong>
        <span>Saldo: {account?.credits ?? 0} créditos</span>
      </p>

      {error && <div className="simple-message error">{error}</div>}

      {missing > 0 ? (
        <button type="button" className="simple-button" onClick={onOpenAccount}>
          Te faltan {missing} créditos · Comprar créditos
        </button>
      ) : (
        <button className="simple-button" disabled={busy || cost === 0}>
          {busy ? 'Comprando...' : `Comprar ${quantity} ${unitLabel(unit, quantity)}`}
        </button>
      )}
    </form>
  )
}

/**
 * Shows a time-pass module while its pass runs; otherwise offers to buy one.
 */
function PassGate({
  gql,
  catalog,
  account,
  feature,
  title,
  description,
  refreshAccount,
  onOpenAccount,
  children,
}) {
  const [now, setNow] = useState(() => new Date())
  const [extending, setExtending] = useState(false)
  const end = passEndsAt(account, feature)

  // Tick so the remaining time stays current and the module closes when the pass ends.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (end && end <= now) {
      refreshAccount()
    }
  }, [now])

  const offer = catalog?.passes.find((pass) => pass.id === feature)

  if (!end || end <= now) {
    return (
      <section className="pass-gate">
        <div className="pass-gate-info">
          <span className="pass-tag">Acceso por tiempo</span>
          <h1>{title}</h1>
          <p>{description}</p>
          {offer && (
            <ul>
              {PASS_UNITS.map((item) => (
                <li key={item.id}>
                  {item.id === 'minutes'
                    ? `${offer.rates.minutes} crédito por cada ${catalog.minutes_block} minutos`
                    : `${offer.rates[item.id]} créditos por ${item.singular}`}
                </li>
              ))}
            </ul>
          )}
        </div>

        <PassPurchase
          gql={gql}
          catalog={catalog}
          account={account}
          feature={feature}
          onBought={refreshAccount}
          onOpenAccount={onOpenAccount}
        />
      </section>
    )
  }

  return (
    <>
      <div className="pass-banner">
        <span>
          Acceso activo hasta <b>{formatDateTime(end)}</b> · quedan{' '}
          {formatRemaining(end, now)}
        </span>
        <button className="simple-link" onClick={() => setExtending(!extending)}>
          {extending ? 'Cerrar' : 'Extender'}
        </button>
      </div>

      {extending && (
        <div className="pass-extend">
          <PassPurchase
            gql={gql}
            catalog={catalog}
            account={account}
            feature={feature}
            onBought={async () => {
              await refreshAccount()
              setExtending(false)
            }}
            onOpenAccount={onOpenAccount}
          />
        </div>
      )}

      {children}
    </>
  )
}

export default PassGate
