const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000'

export async function graphqlRequest(query, variables = {}, token = null) {
  const response = await fetch(`${API_URL}/graphql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  })

  const result = await response.json().catch(() => null)

  if (!response.ok || (result && result.errors && result.errors.length > 0)) {
    const errorMsg =
      result?.errors?.[0]?.message ||
      result?.message ||
      'No se pudo completar la solicitud GraphQL.'
    throw new Error(errorMsg)
  }

  return result.data
}

export async function loginRequest(login) {
  const data = await graphqlRequest(
    `
    mutation Login($input: LoginInput!) {
      login(input: $input) {
        message
        token
        user {
          id
          name
          email
          role
        }
      }
    }
  `,
    { input: login }
  )

  return data.login
}

export async function registerRequest(registration) {
  const data = await graphqlRequest(
    `
    mutation Register($input: RegisterInput!) {
      register(input: $input) {
        message
        token
        user {
          id
          name
          email
          role
        }
      }
    }
  `,
    { input: registration }
  )

  return data.register
}