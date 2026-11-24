import { PLATFORM_NAME } from '../utils/brand.js'
import { linkProps } from '../utils/router.js'
import { homeFor, readSession } from '../utils/session.js'

/**
 * Header of the public pages: home page and hotel listing.
 */
function PublicNav({ current }) {
  const session = readSession()

  return (
    <header className="landing-nav">
      <a className="landing-brand" {...linkProps('/')}>
        {PLATFORM_NAME}
      </a>

      <nav aria-label="Principal">
        <a {...linkProps('/#planes')}>Planes</a>
        <a
          {...linkProps('/hoteles')}
          aria-current={current === 'hotels' ? 'page' : undefined}
        >
          Hoteles
        </a>
        {session ? (
          <a {...linkProps(homeFor(session.user))}>
            {session.user.role === 'customer' ? 'Mi cuenta' : 'Mi panel'}
          </a>
        ) : (
          <a {...linkProps('/login')}>Iniciar sesión</a>
        )}
        <a className="simple-button" {...linkProps('/registrar-hotel')}>
          Registrar mi hotel
        </a>
      </nav>
    </header>
  )
}

export default PublicNav
