import { useEffect, useState } from 'react'

/**
 * Minimal client-side routing with the History API:
 *   /                  home page (plans and hotels)
 *   /hoteles           hotels guests can book
 *   /registrar-hotel   hotel sign-up
 *   /login             sign in
 *   /h/:slug           a hotel's booking page
 *   /panel             hotel admin panel
 *   /mi-cuenta         guest account
 *   /plataforma        platform operator (superadmin)
 */
export function matchRoute(pathname) {
  const hotel = pathname.match(/^\/h\/([^/]+)\/?$/)

  if (hotel) {
    return { page: 'hotel', slug: decodeURIComponent(hotel[1]) }
  }

  const pages = {
    '/': 'home',
    '/hoteles': 'hotels',
    '/registrar-hotel': 'signup',
    '/login': 'login',
    '/panel': 'panel',
    '/mi-cuenta': 'account',
    '/plataforma': 'platform',
  }

  return { page: pages[pathname.replace(/\/$/, '') || '/'] || 'home' }
}

export function navigate(path, { replace = false } = {}) {
  if (replace) {
    window.history.replaceState(null, '', path)
  } else {
    window.history.pushState(null, '', path)
  }

  window.dispatchEvent(new PopStateEvent('popstate'))

  const hash = path.split('#')[1]

  if (hash) {
    // Wait for the new page to render before scrolling to the section.
    setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' }), 50)
  } else {
    window.scrollTo(0, 0)
  }
}

export function useRoute() {
  const [route, setRoute] = useState(() => matchRoute(window.location.pathname))

  useEffect(() => {
    const update = () => setRoute(matchRoute(window.location.pathname))

    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  return route
}

/**
 * Plain anchor that navigates without reloading the page.
 */
export function linkProps(path) {
  return {
    href: path,
    onClick: (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
        return
      }

      event.preventDefault()
      navigate(path)
    },
  }
}
