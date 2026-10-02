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