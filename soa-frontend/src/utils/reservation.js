export function reservationNights(checkIn, checkOut) {
  const start = new Date(`${checkIn}T00:00:00`)
  const end = new Date(`${checkOut}T00:00:00`)

  return Math.max(
    0,
    Math.round((end - start) / 86400000)
  )
}

export function money(value) {
  return `$${Number(value || 0).toFixed(2)}`
}

const RESERVATION_STATUS = {
  pending: { label: 'Pendiente de pago', tone: 'occupied' },
  confirmed: { label: 'Confirmada', tone: 'available' },
  cancelled: { label: 'Cancelada', tone: 'inactive' },
  expired: { label: 'Expirada', tone: 'inactive' },
}

const PAYMENT_STATUS = {
  pending: 'Pago en proceso',
  paid: 'Pagado',
  failed: 'Pago no completado',
  refunded: 'Reembolsado',
}

export function isPaymentWindowOpen(reservation) {
  return (
    reservation.status === 'pending' &&
    (!reservation.expires_at ||
      new Date(reservation.expires_at) > new Date())
  )
}

export function reservationStatus(reservation) {
  if (
    reservation.status === 'pending' &&
    !isPaymentWindowOpen(reservation)
  ) {
    return RESERVATION_STATUS.expired
  }

  return (
    RESERVATION_STATUS[reservation.status] || {
      label: reservation.status,
      tone: 'inactive',
    }
  )
}

export function paymentStatusLabel(payment) {
  if (!payment) {
    return 'Sin pago'
  }

  const label = PAYMENT_STATUS[payment.status] || payment.status

  return payment.method === 'cash' ? `${label} (efectivo)` : label
}

export function formatTime(value) {
  return new Date(value).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  })
}
