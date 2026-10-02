const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000'

export async function request(path, options = {}, token = null) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
      ...options.headers,
    },
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.message || 'No se pudo completar la solicitud.'
    )
  }

  return data
}

export async function loginRequest(login) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(login),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Credenciales inválidas.')
  }

  return data
}

export async function registerRequest(registration) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(registration),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'No se pudo completar el registro.')
  }

  return data
}