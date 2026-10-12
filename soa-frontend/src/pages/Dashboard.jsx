import { useEffect, useState } from 'react'
import Login from '../components/Login.jsx'
import Register from '../components/Register.jsx'
import AdminDashboard from '../components/AdminDashboard.jsx'
import CustomerDashboard from '../components/CustomerDashboard.jsx'
import {
  graphqlRequest,
  loginRequest,
  logoutRequest,
  registerRequest,
} from '../services/api.js'

const EMPTY_ROOM = {
  number: '',
  type: '',
  description: '',
  price: '',
  capacity: 1,
  features: '',
  status: 'available',
}

const EMPTY_BOOKING = {
  room_id: '',
  check_in: '',
  check_out: '',
}

function Dashboard() {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem('soa-session')

    try {
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [rooms, setRooms] = useState([])
  const [reservations, setReservations] = useState([])
  const [login, setLogin] = useState({
    email: '',
    password: '',
  })

  const [register, setRegister] = useState({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
  })

  const [showRegister, setShowRegister] = useState(false)

  const [room, setRoom] = useState(EMPTY_ROOM)
  const [booking, setBooking] = useState(EMPTY_BOOKING)

  const [editingId, setEditingId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [customerDataReady, setCustomerDataReady] =
    useState(false)

  const isAdmin = session?.user?.role === 'admin'

  useEffect(() => {
    if (!session) {
      return
    }

    if (isAdmin) {
      loadRooms()
      loadReservations()
    } else {
      loadCustomerData()
    }
  }, [session, isAdmin])

  async function gql(query, variables = {}) {
    try {
      return await graphqlRequest(query, variables, session?.token)
    } catch (err) {
      if (session && err.code === 'UNAUTHENTICATED') {
        clearSession()
        throw new Error('Tu sesión expiró. Inicia sesión de nuevo.')
      }

      throw err
    }
  }

  async function loadRooms() {
    try {
      const data = await gql(`
        query GetRooms {
          rooms {
            id
            number
            type
            description
            price
            capacity
            features
            status
          }
        }
      `)
      setRooms(data.rooms || [])
    } catch (err) {
      showError(err.message)
    }
  }

  async function loadAvailableRooms() {
    try {
      const data = await gql(`
        query GetAvailableRooms {
          availableRooms {
            id
            number
            type
            description
            price
            capacity
            features
            status
          }
        }
      `)
      setRooms(data.availableRooms || [])
    } catch (err) {
      showError(err.message)
    }
  }

  async function loadReservations() {
    try {
      const data = await gql(`
        query GetReservations {
          reservations {
            id
            room_id
            user_id
            check_in
            check_out
            status
            room {
              id
              number
              type
              price
            }
            user {
              id
              name
              email
            }
          }
        }
      `)
      setReservations(data.reservations || [])
    } catch (err) {
      showError(err.message)
    }
  }

  async function loadCustomerData() {
    setCustomerDataReady(false)

    try {
      const data = await gql(`
        query GetCustomerData {
          availableRooms {
            id
            number
            type
            description
            price
            capacity
            features
            status
          }
          reservations {
            id
            room_id
            user_id
            check_in
            check_out
            status
            room {
              id
              number
              type
              price
            }
          }
        }
      `)

      setRooms(data.availableRooms || [])
      setReservations(data.reservations || [])
      setCustomerDataReady(true)
    } catch (err) {
      showError(err.message)
      setCustomerDataReady(true)
    }
  }

  async function loginUser(loginData) {
    setBusy(true)
    clearMessage()

    try {
      const data = await loginRequest(loginData)

      const newSession = {
        token: data.token,
        user: data.user,
      }

      localStorage.setItem(
        'soa-session',
        JSON.stringify(newSession)
      )

      setSession(newSession)
    } catch (err) {
      showError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function registerUser(registerData) {
    setBusy(true)
    clearMessage()

    try {
      await registerRequest(registerData)

      setMessage('Cuenta creada correctamente.')
      setShowRegister(false)

      setRegister({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
      })
    } catch (err) {
      showError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    setBusy(true)

    try {
      await logoutRequest(session?.token)
    } catch {
      // The token may already be invalid; the local session is cleared anyway.
    } finally {
      setBusy(false)
    }

    clearSession()
    setMessage('')
    setError('')
  }

  function clearSession() {
    localStorage.removeItem('soa-session')

    setSession(null)
    setRooms([])
    setReservations([])
    setBooking(EMPTY_BOOKING)
    setModalOpen(false)
    setCustomerDataReady(false)
  }

  function openCreateModal() {
    setRoom(EMPTY_ROOM)
    setEditingId(null)
    clearMessage()
    setModalOpen(true)
  }

  function openEditModal(roomToEdit) {
    setRoom({
      ...roomToEdit,
      features: Array.isArray(roomToEdit.features)
        ? roomToEdit.features.join(', ')
        : roomToEdit.features || '',
    })

    setEditingId(roomToEdit.id)
    clearMessage()
    setModalOpen(true)
  }

  async function saveRoom(event) {
    event.preventDefault()

    setBusy(true)
    clearMessage()

    try {
      const payload = {
        number: room.number,
        type: room.type,
        description: room.description || '',
        price: Number(room.price),
        capacity: Number(room.capacity),
        features:
          typeof room.features === 'string'
            ? room.features
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            : room.features || [],
        status: room.status,
      }

      if (editingId) {
        await gql(
          `
          mutation UpdateRoom($id: ID!, $input: CreateRoomInput!) {
            updateRoom(id: $id, input: $input) {
              id
              number
            }
          }
        `,
          { id: editingId, input: payload }
        )

        setMessage('Habitación actualizada correctamente.')
      } else {
        await gql(
          `
          mutation CreateRoom($input: CreateRoomInput!) {
            createRoom(input: $input) {
              id
              number
            }
          }
        `,
          { input: payload }
        )

        setMessage('Habitación creada correctamente.')
      }

      setRoom(EMPTY_ROOM)
      setEditingId(null)
      setModalOpen(false)

      await loadRooms()
    } catch (err) {
      showError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function deleteRoom(roomToDelete) {
    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar la habitación ${roomToDelete.number}?`
    )

    if (!confirmed) {
      return
    }

    setBusy(true)
    clearMessage()

    try {
      await gql(
        `
        mutation DeleteRoom($id: ID!) {
          deleteRoom(id: $id)
        }
      `,
        { id: roomToDelete.id }
      )

      setMessage('Habitación eliminada correctamente.')

      await loadRooms()
    } catch (err) {
      showError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function createReservation(event) {
    event.preventDefault()

    setBusy(true)
    clearMessage()

    try {
      await gql(
        `
        mutation CreateReservation($input: CreateReservationInput!) {
          createReservation(input: $input) {
            id
            status
          }
        }
      `,
        {
          input: {
            room_id: Number(booking.room_id),
            check_in: booking.check_in,
            check_out: booking.check_out,
          },
        }
      )

      setBooking(EMPTY_BOOKING)

      setMessage('Reservación creada correctamente.')

      await loadCustomerData()
    } catch (err) {
      showError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function cancelReservation(id) {
    const confirmed = window.confirm(
      '¿Seguro que deseas cancelar esta reservación?'
    )

    if (!confirmed) {
      return
    }

    setBusy(true)
    clearMessage()

    try {
      await gql(
        `
        mutation CancelReservation($id: ID!) {
          cancelReservation(id: $id) {
            id
            status
          }
        }
      `,
        { id }
      )

      setMessage('Reservación cancelada correctamente.')

      if (isAdmin) {
        await loadReservations()
      } else {
        await loadCustomerData()
      }
    } catch (err) {
      showError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function clearMessage() {
    setMessage('')
    setError('')
  }

  function showError(msg) {
    setMessage('')
    setError(msg)
  }

  if (!session) {
    if (showRegister) {
      return (
        <Register
          register={register}
          setRegister={setRegister}
          registerUser={registerUser}
          busy={busy}
          error={error}
          message={message}
          onLogin={() => {
            clearMessage()
            setShowRegister(false)
          }}
        />
      )
    }

    return (
      <Login
        login={login}
        setLogin={setLogin}
        loginUser={loginUser}
        busy={busy}
        error={error}
        message={message}
        onRegister={() => {
          clearMessage()
          setShowRegister(true)
        }}
      />
    )
  }

  if (isAdmin) {
    return (
      <AdminDashboard
        rooms={rooms}
        reservations={reservations}
        room={room}
        setRoom={setRoom}
        editingId={editingId}
        modalOpen={modalOpen}
        openCreateModal={openCreateModal}
        openEditModal={openEditModal}
        saveRoom={saveRoom}
        deleteRoom={deleteRoom}
        cancelReservation={cancelReservation}
        setModalOpen={setModalOpen}
        message={message}
        error={error}
        busy={busy}
        logout={logout}
      />
    )
  }

  return (
    <CustomerDashboard
      rooms={rooms}
      reservations={reservations}
      booking={booking}
      setBooking={setBooking}
      createReservation={createReservation}
      cancelReservation={cancelReservation}
      message={message}
      error={error}
      busy={busy}
      ready={customerDataReady}
      logout={logout}
    />
  )
}

export default Dashboard