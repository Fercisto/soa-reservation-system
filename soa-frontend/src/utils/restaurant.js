const ROLE_LABELS = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerente',
  RECEPTIONIST: 'Recepcionista',
  HOUSEKEEPING: 'Limpieza',
  MAINTENANCE: 'Mantenimiento',
  ROOM_SERVICE: 'Servicio a la habitación',
  WAITER: 'Mesero',
  CHEF: 'Chef',
  CASHIER: 'Cajero',
}

const SHIFT_LABELS = {
  MORNING: 'Matutino',
  AFTERNOON: 'Vespertino',
  NIGHT: 'Nocturno',
  FULL_TIME: 'Tiempo completo',
}

export function roleLabel(role) {
  return ROLE_LABELS[role] || role
}

export function shiftLabel(shift) {
  return SHIFT_LABELS[shift] || shift
}
