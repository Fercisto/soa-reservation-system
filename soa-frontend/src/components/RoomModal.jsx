function RoomModal({
  room,
  setRoom,
  editingId,
  saveRoom,
  close,
  busy,
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) =>
        event.target === event.currentTarget && close()
      }
    >
      <form
        className="room-modal"
        onSubmit={saveRoom}
      >
        <div className="modal-header">
          <h2>
            {editingId
              ? 'Editar habitación'
              : 'Agregar habitación'}
          </h2>

          <button
            type="button"
            className="simple-link"
            onClick={close}
          >
            Cerrar
          </button>
        </div>

        <label>
          Número

          <input
            required
            value={room.number}
            onChange={(event) =>
              setRoom({
                ...room,
                number: event.target.value,
              })
            }
          />
        </label>

        <label>
          Tipo

          <input
            required
            value={room.type}
            onChange={(event) =>
              setRoom({
                ...room,
                type: event.target.value,
              })
            }
          />
        </label>

        <div className="modal-row">
          <label>
            Precio

            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={room.price}
              onChange={(event) =>
                setRoom({
                  ...room,
                  price: event.target.value,
                })
              }
            />
          </label>

          <label>
            Capacidad

            <input
              required
              type="number"
              min="1"
              value={room.capacity}
              onChange={(event) =>
                setRoom({
                  ...room,
                  capacity: event.target.value,
                })
              }
            />
          </label>
        </div>

        <label>
          Descripción

          <textarea
            value={room.description || ''}
            onChange={(event) =>
              setRoom({
                ...room,
                description: event.target.value,
              })
            }
          />
        </label>

        <label>
          Características{' '}
          <small>separadas por comas</small>

          <input
            value={room.features}
            onChange={(event) =>
              setRoom({
                ...room,
                features: event.target.value,
              })
            }
          />
        </label>

        <label>
          Estado

          <select
            value={room.status}
            onChange={(event) =>
              setRoom({
                ...room,
                status: event.target.value,
              })
            }
          >
            <option value="available">
              Disponible
            </option>

            <option value="occupied">
              Ocupada
            </option>

            <option value="maintenance">
              Mantenimiento
            </option>

            <option value="inactive">
              Inactiva
            </option>
          </select>
        </label>

        <div className="modal-actions">
          <button
            type="button"
            className="simple-link"
            onClick={close}
          >
            Cancelar
          </button>

          <button
            className="simple-button"
            disabled={busy}
          >
            {busy
              ? 'Guardando...'
              : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default RoomModal