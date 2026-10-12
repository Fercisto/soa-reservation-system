import { useEffect, useRef, useState } from 'react'

function timeAgo(value) {
  const minutes = Math.round((Date.now() - new Date(value)) / 60000)

  if (minutes < 1) return 'Justo ahora'
  if (minutes < 60) return `Hace ${minutes} min`

  const hours = Math.round(minutes / 60)
  if (hours < 24) return `Hace ${hours} h`

  return new Date(value).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
  })
}

function NotificationBell({
  notifications,
  unreadCount,
  markAsRead,
  markAllAsRead,
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) {
      return
    }

    function closeOnOutsideClick(event) {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="notification-bell" ref={containerRef}>
      <button
        type="button"
        className="notification-trigger"
        aria-label={`Notificaciones${
          unreadCount ? `, ${unreadCount} sin leer` : ''
        }`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden="true"
        >
          <path
            d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.84V3.5a1.5 1.5 0 0 0-3 0v.66A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z"
            fill="currentColor"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-panel">
          <div className="notification-panel-header">
            <strong>Notificaciones</strong>

            {unreadCount > 0 && (
              <button
                type="button"
                className="simple-link"
                onClick={markAllAsRead}
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="notification-empty">
              No tienes notificaciones.
            </p>
          ) : (
            <ul className="notification-list">
              {notifications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`notification-item ${
                      item.read_at ? '' : 'unread'
                    }`}
                    onClick={() =>
                      !item.read_at && markAsRead(item.id)
                    }
                  >
                    <strong>{item.title}</strong>
                    <span>{item.message}</span>
                    <small>{timeAgo(item.created_at)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell
