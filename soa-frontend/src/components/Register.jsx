function Register({
  register,
  setRegister,
  registerUser,
  busy,
  error,
  message,
  onLogin,
}) {
  return (
    <main className="simple-login">
      <form
        className="login-card"
        onSubmit={(event) => {
          event.preventDefault()
          registerUser(register)
        }}
      >
        <h1>Crear cuenta</h1>

        <p>
          Regístrate para realizar reservaciones.
        </p>

        <label>
          Nombre
          <input
            required
            type="text"
            value={register.name}
            onChange={(event) =>
              setRegister({
                ...register,
                name: event.target.value,
              })
            }
          />
        </label>

        <label>
          Correo electrónico
          <input
            required
            type="email"
            value={register.email}
            onChange={(event) =>
              setRegister({
                ...register,
                email: event.target.value,
              })
            }
          />
        </label>

        <label>
          Contraseña
          <input
            required
            type="password"
            value={register.password}
            onChange={(event) =>
              setRegister({
                ...register,
                password: event.target.value,
              })
            }
          />
        </label>

        <label>
          Confirmar contraseña
          <input
            required
            type="password"
            value={register.password_confirmation}
            onChange={(event) =>
              setRegister({
                ...register,
                password_confirmation:
                  event.target.value,
              })
            }
          />
        </label>

        <button
          className="simple-button"
          disabled={busy}
        >
          {busy ? 'Registrando...' : 'Registrarse'}
        </button>

        {error && (
          <div className="simple-message error">
            {error}
          </div>
        )}

        {message && (
          <div className="simple-message success">
            {message}
          </div>
        )}

        <p className="auth-switch">
          ¿Ya tienes cuenta?{' '}
          <button type="button" className="simple-link" onClick={onLogin}>
            Iniciar sesión
          </button>
        </p>
      </form>
    </main>
  )
}

export default Register