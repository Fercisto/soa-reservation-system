import { useEffect, useState } from 'react'
import Login from '../components/Login.jsx'
import Register from '../components/Register.jsx'
import AdminDashboard from '../components/AdminDashboard.jsx'
import CustomerDashboard from '../components/CustomerDashboard.jsx'

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3000'

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

  async function request(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(session?.token
          ? {
              Authorization: `Bearer ${session.token}`,
            }
          : {}),
        ...options.headers,
      },
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      throw new Error(
        data?.message ||
          'No se pudo completar la solicitud.'
      )
    }

    return data
  }

  async function loadRooms() {
    try {
      const data = await request('/rooms/available')
      setRooms(data)
    } catch (err) {
      showError(err.message)
    }
  }

  async function loadAvailableRooms() {
    try {
      const data = await request('/rooms/available')
      setRooms(data)
    } catch (err) {
      showError(err.message)
    }
  }

  async function loadReservations() {
    try {
      const data = await request('/reservations')
      setReservations(data)
    } catch (err) {
      showError(err.message)
    }
  }

  async function loadCustomerData() {
    setCustomerDataReady(false)

    try {
      const [roomsData, reservationsData] =
        await Promise.all([
          request('/rooms/available'),
          request('/reservations'),
        ])

      setRooms(roomsData)
      setReservations(reservationsData)
      setCustomerDataReady(true)
    } catch (err) {
      showError(err.message)
      setCustomerDataReady(true)
    }
  }

  async function loginUser(login) {
    setBusy(true)
    clearMessage()

    try {
      const response = await fetch(
        `${API_URL}/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(login),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.message || 'Credenciales inválidas.'
        )
      }

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

  async function registerUser(register) {
    setBusy(true)
    clearMessage()

    try {
      const response = await fetch(
        `${API_URL}/auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(register),
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data?.message || 'No se pudo crear la cuenta.'
        )
      }

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


  function logout() {
    localStorage.removeItem('soa-session')

    setSession(null)
    setRooms([])
    setReservations([])
    setBooking(EMPTY_BOOKING)
    setMessage('')
    setError('')
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
        description: room.description,
        price: Number(room.price),
        capacity: Number(room.capacity),
        features:
          typeof room.features === 'string'
            ? room.features
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            : room.features,
        status: room.status,
      }

      if (editingId) {
        await request(`/rooms/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })

        setMessage(
          'Habitación actualizada correctamente.'
        )
      } else {
        await request('/rooms', {
          method: 'POST',
          body: JSON.stringify(payload),
        })

        setMessage(
          'Habitación creada correctamente.'
        )
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
      await request(`/rooms/${roomToDelete.id}`, {
        method: 'DELETE',
      })

      setMessage(
        'Habitación eliminada correctamente.'
      )

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
      await request('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          room_id: Number(booking.room_id),
          check_in: booking.check_in,
          check_out: booking.check_out,
        }),
      })

      setBooking(EMPTY_BOOKING)

      setMessage(
        'Reservación creada correctamente.'
      )

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
      await request(`/reservations/${id}/cancel`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      })

      setMessage(
        'Reservación cancelada correctamente.'
      )

      await loadCustomerData()
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

  function showError(message) {
    setMessage('')
    setError(message)
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