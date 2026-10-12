import { useEffect, useRef, useState } from 'react'
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

const NOTIFICATIONS_REFRESH_MS = 30000

// Dates used to filter available rooms, or null while the range is incomplete.
function bookingDates(booking) {
  if (
    !booking.check_in ||
    !booking.check_out ||
    booking.check_out <= booking.check_in
  ) {
    return null
  }

  return { checkIn: booking.check_in, checkOut: booking.check_out }
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
  const roomsRequest = useRef(0)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

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

  useEffect(() => {
    if (!session || isAdmin || !customerDataReady) {
      return
    }

    loadAvailableRooms()
  }, [booking.check_in, booking.check_out])

  useEffect(() => {
    if (!session) {
      return
    }

    loadNotifications()
    const interval = setInterval(
      loadNotifications,
      NOTIFICATIONS_REFRESH_MS
    )

    return () => clearInterval(interval)
  }, [session])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get('payment')
    const paymentId = params.get('payment_id')

    if (!session || !result || !paymentId) {
      return
    }

    // Clear the query string first so a reload (or StrictMode) doesn't repeat it.
    window.history.replaceState(null, '', window.location.pathname)
    handleCheckoutReturn(result, paymentId)
  }, [session])

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
    const dates = bookingDates(booking)
    const request = ++roomsRequest.current

    try {
      const data = await gql(
        `
        query GetAvailableRooms($checkIn: String, $checkOut: String) {
          availableRooms(checkIn: $checkIn, checkOut: $checkOut) {
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
      `,
        dates || {}
      )

      // Ignore answers that arrive after the dates changed again.
      if (request === roomsRequest.current) {
        applyAvailableRooms(data.availableRooms || [], dates)
      }
    } catch (err) {
      showError(err.message)
    }
  }

  function applyAvailableRooms(availableRooms, dates) {
    const selected = rooms.find(
      (item) => String(item.id) === String(booking.room_id)
    )
    const stillAvailable = availableRooms.some(
      (item) => String(item.id) === String(booking.room_id)
    )

    setRooms(availableRooms)

    if (dates && selected && !stillAvailable) {
      setBooking((current) => ({ ...current, room_id: '' }))
      showError(
        `La habitación ${selected.number} no está disponible del ${dates.checkIn} al ${dates.checkOut}. Elige otra.`
      )
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
            expires_at
            latest_payment {
              id
              status
              method
              amount
              checkout_url
            }
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
      const dates = bookingDates(booking)
      const request = ++roomsRequest.current
      const data = await gql(
        `
        query GetCustomerData($checkIn: String, $checkOut: String) {
          availableRooms(checkIn: $checkIn, checkOut: $checkOut) {
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
            expires_at
            latest_payment {
              id
              status
              method
              amount
              checkout_url
            }
            room {
              id
              number
              type
              price
            }
          }
        }
      `,
        dates || {}
      )

      if (request === roomsRequest.current) {
        applyAvailableRooms(data.availableRooms || [], dates)
      }
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
    setNotifications([])
    setUnreadCount(0)
  }

  async function loadNotifications() {
    try {
      const data = await gql(`
        query GetNotifications {
          notifications(limit: 20) {
            unread_count
            notifications {
              id
              type
              title
              message
              reservation_id
              read_at
              created_at
            }
          }
        }
      `)

      setNotifications(data.notifications.notifications)
      setUnreadCount(data.notifications.unread_count)
    } catch {
      // Background refresh: a failure here should not interrupt the user.
    }
  }

  async function markNotificationAsRead(id) {
    try {
      const data = await gql(
        `
        mutation MarkNotificationAsRead($id: ID!) {
          markNotificationAsRead(id: $id) {
            id
            read_at
          }
        }
      `,
        { id }
      )

      const readAt = data.markNotificationAsRead.read_at

      setNotifications((items) =>
        items.map((item) =>
          item.id === id ? { ...item, read_at: readAt } : item
        )
      )
      setUnreadCount((count) => Math.max(0, count - 1))
    } catch (err) {
      showError(err.message)
    }
  }

  async function markAllNotificationsAsRead() {
    try {
      await gql(`
        mutation MarkAllNotificationsAsRead {
          markAllNotificationsAsRead
        }
      `)

      const readAt = new Date().toISOString()

      setNotifications((items) =>
        items.map((item) => ({
          ...item,
          read_at: item.read_at || readAt,
        }))
      )
      setUnreadCount(0)
    } catch (err) {
      showError(err.message)
    }
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
      const data = await gql(
        `
        mutation CreateReservation($input: CreateReservationInput!) {
          createReservation(input: $input) {
            id
            status
            latest_payment {
              checkout_url
            }
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

      redirectToCheckout(data.createReservation.latest_payment?.checkout_url)
    } catch (err) {
      showError(err.message)
      setBusy(false)
    }
  }

  function redirectToCheckout(checkoutUrl) {
    if (!checkoutUrl) {
      throw new Error('No se pudo iniciar el pago.')
    }

    setMessage('Redirigiendo a la página de pago...')
    window.location.assign(checkoutUrl)
  }

  async function payReservation(reservation) {
    setBusy(true)
    clearMessage()

    try {
      const data = await gql(
        `
        mutation PayReservation($input: CreatePaymentInput!) {
          createPayment(input: $input) {
            id
            checkout_url
          }
        }
      `,
        { input: { reservation_id: Number(reservation.id) } }
      )

      redirectToCheckout(data.createPayment.checkout_url)
    } catch (err) {
      showError(err.message)
      setBusy(false)
    }
  }

  async function registerCashPayment(reservation) {
    const confirmed = window.confirm(
      `¿Registrar el pago en efectivo de la habitación ${
        reservation.room?.number || reservation.room_id
      }?`
    )

    if (!confirmed) {
      return
    }

    setBusy(true)
    clearMessage()

    try {
      await gql(
        `
        mutation RegisterCashPayment($input: CreatePaymentInput!) {
          createPayment(input: $input) {
            id
            status
          }
        }
      `,
        {
          input: {
            reservation_id: Number(reservation.id),
            method: 'cash',
          },
        }
      )

      setMessage('Pago en efectivo registrado. La reservación está confirmada.')

      await Promise.all([loadReservations(), loadNotifications()])
    } catch (err) {
      showError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleCheckoutReturn(result, paymentId) {
    setBusy(true)
    clearMessage()

    try {
      if (result === 'success') {
        const data = await gql(
          `
          mutation VerifyPayment($id: ID!) {
            verifyPayment(id: $id) {
              id
              status
            }
          }
        `,
          { id: paymentId }
        )

        if (data.verifyPayment.status === 'paid') {
          setMessage('Pago recibido. Tu reservación está confirmada.')
        } else {
          setMessage(
            'Tu pago se está procesando. La reservación se confirmará en cuanto se acredite.'
          )
        }
      } else {
        const data = await gql(
          `
          query CheckoutPayment($id: ID!) {
            payment(id: $id) {
              id
              status
              reservation_id
            }
          }
        `,
          { id: paymentId }
        )

        if (data.payment?.status === 'pending') {
          await gql(
            `
            mutation ReleaseReservation($id: ID!) {
              cancelReservation(id: $id) {
                id
              }
            }
          `,
            { id: data.payment.reservation_id }
          )
        }

        setMessage(
          'Pago cancelado. La reservación no se realizó y las fechas quedaron libres.'
        )
      }
    } catch (err) {
      showError(err.message)
    } finally {
      setBusy(false)
      await Promise.all([loadCustomerData(), loadNotifications()])
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

      await Promise.all([
        isAdmin ? loadReservations() : loadCustomerData(),
        loadNotifications(),
      ])
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

  const notificationProps = {
    notifications,
    unreadCount,
    markAsRead: markNotificationAsRead,
    markAllAsRead: markAllNotificationsAsRead,
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
        registerCashPayment={registerCashPayment}
        setModalOpen={setModalOpen}
        message={message}
        error={error}
        busy={busy}
        logout={logout}
        notificationProps={notificationProps}
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
      payReservation={payReservation}
      cancelReservation={cancelReservation}
      message={message}
      error={error}
      busy={busy}
      ready={customerDataReady}
      logout={logout}
      notificationProps={notificationProps}
    />
  )
}

export default Dashboard