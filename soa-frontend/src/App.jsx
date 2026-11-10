import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import HotelSignup from './pages/HotelSignup'
import Hotels from './pages/Hotels'
import { useRoute } from './utils/router.js'

function App() {
  const route = useRoute()

  if (route.page === 'home') {
    return <Landing />
  }

  if (route.page === 'hotels') {
    return <Hotels />
  }

  if (route.page === 'signup') {
    return <HotelSignup />
  }

  // Sign-in, the admin panel, the guest account and each hotel's page share the session.
  return <Dashboard route={route} />
}

export default App
