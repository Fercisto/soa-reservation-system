// Modules included in the plans, in display order.
export const PLAN_FEATURES = [
  { id: 'rooms', label: 'Habitaciones' },
  { id: 'reservations', label: 'Reservaciones en línea' },
  { id: 'payments', label: 'Pagos con tarjeta (Stripe)' },
  { id: 'notifications', label: 'Notificaciones' },
  { id: 'overview', label: 'Resumen con KPIs' },
  { id: 'staff', label: 'Personal y turnos' },
  { id: 'restaurant', label: 'Menú del restaurante' },
]

export const PASS_UNITS = [
  { id: 'minutes', label: 'Minutos', singular: 'minuto', plural: 'minutos' },
  { id: 'hours', label: 'Horas', singular: 'hora', plural: 'horas' },
  { id: 'days', label: 'Días', singular: 'día', plural: 'días' },
]

const TRANSACTION_TYPES = {
  purchase: 'Compra',
  bonus: 'Bono',
  usage: 'Uso',
}

export function transactionTypeLabel(type) {
  return TRANSACTION_TYPES[type] || type
}

export function featureLabel(id) {
  return PLAN_FEATURES.find((feature) => feature.id === id)?.label || id
}

// The cheapest plan that includes a module.
export function planFor(feature, plans = []) {
  return plans.find((plan) => plan.features.includes(feature))
}

export function hasFeature(hotel, feature) {
  return Boolean(hotel?.plan_active && hotel.features?.includes(feature))
}

export function unitLabel(unit, quantity) {
  const found = PASS_UNITS.find((item) => item.id === unit)

  if (!found) {
    return unit
  }

  return Number(quantity) === 1 ? found.singular : found.plural
}

// Credits a pass costs; minutes are sold in blocks, like the server charges them.
export function passCost(catalog, feature, unit, quantity) {
  const pass = catalog?.passes.find((item) => item.id === feature)
  const rate = pass?.rates?.[unit] || 0
  const amount = Number(quantity) || 0

  if (unit === 'minutes') {
    return Math.ceil(amount / (catalog.minutes_block || 15)) * rate
  }

  return amount * rate
}

export function passEndsAt(hotel, feature) {
  const end = hotel?.active_passes?.[feature]

  return end && new Date(end) > new Date() ? new Date(end) : null
}

export function formatRemaining(end, now = new Date()) {
  const minutes = Math.max(0, Math.ceil((end - now) / 60000))

  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 48) {
    return `${hours} h ${minutes % 60} min`
  }

  return `${Math.floor(hours / 24)} días ${hours % 24} h`
}

export function formatDateTime(value) {
  if (!value) {
    return ''
  }

  return new Date(value).toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(value) {
  if (!value) {
    return ''
  }

  return new Date(value).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export const CATALOG_QUERY = `
  platformCatalog {
    period_days
    minutes_block
    pass_limits
    plans { id name price room_limit monthly_credits features }
    credit_packages { id name credits price }
    credit_features { id name cost unit }
    passes { id name rates }
  }
`

export const HOTEL_ACCOUNT_FIELDS = `
  id
  name
  slug
  city
  description
  plan
  plan_name
  plan_active
  plan_expires_at
  credits
  features
  room_limit
  active_passes
`
