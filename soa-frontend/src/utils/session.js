const SESSION_KEY = 'soa-session'

export function readSession() {
  try {
    const saved = localStorage.getItem(SESSION_KEY)

    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

export function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Without storage the session lasts until the page is reloaded.
  }
}

export function removeSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // Nothing stored.
  }
}

// Where each kind of user lands after signing in.
export function homeFor(user) {
  if (user?.role === 'superadmin') {
    return '/plataforma'
  }

  return user?.role === 'admin' ? '/panel' : '/mi-cuenta'
}
