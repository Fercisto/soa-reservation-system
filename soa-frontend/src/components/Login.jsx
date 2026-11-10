import { PLATFORM_NAME } from '../utils/brand.js'
import { linkProps } from '../utils/router.js'

function Login({
  login,
  setLogin,
  loginUser,
  busy,
  error,
  message,
  onRegister,
  brand = PLATFORM_NAME,
  subtitle,
}) {
  return (
    <main className="simple-login">
      <form
        className="login-card"
        onSubmit={(event) => {
          event.preventDefault()
          loginUser(login)
        }}
      >
        <a className="login-brand" {...linkProps('/')}>
          {brand}
        </a>

        <h1>Iniciar sesión</h1>

        <p>
          {subtitle || 'Ingresa para reservar tu estancia o administrar tu hotel.'}
        </p>

        <label>
          Correo electrónico

          <input
            required
            type="email"
            value={login.email}
            onChange={(event) =>
              setLogin({
                ...login,
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
            value={login.password}
            onChange={(event) =>
              setLogin({
                ...login,
                password: event.target.value,
              })
            }
          />
        </label>

        <button
          className="simple-button"
          disabled={busy}
        >
          {busy ? 'Ingresando...' : 'Ingresar'}
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
          ¿No tienes cuenta?{' '}
          <button type="button" className="simple-link" onClick={onRegister}>
            Crear una
          </button>
        </p>

        <p className="auth-switch">
          ¿Tienes un hotel?{' '}
          <a className="simple-link" {...linkProps('/registrar-hotel')}>
            Regístralo en {PLATFORM_NAME}
          </a>
        </p>
      </form>
    </main>
  )
}

export default Login