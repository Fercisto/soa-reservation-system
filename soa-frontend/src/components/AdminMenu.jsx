import { useEffect, useState } from 'react'
import { money } from '../utils/reservation.js'

const EMPTY_DISH = {
  name: '',
  description: '',
  price: '',
  categoryId: '',
  available: true,
}

const DISH_FIELDS = `
  id
  name
  description
  price
  categoryId
  category
  available
`

/**
 * Hotel restaurant menu. Categories and dishes are stored in the
 * restaurant system's menu-service, reached through Nest.
 */
function AdminMenu({ gql }) {
  const [categories, setCategories] = useState([])
  const [dishes, setDishes] = useState([])
  const [ready, setReady] = useState(false)
  const [filter, setFilter] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [dish, setDish] = useState(EMPTY_DISH)
  const [editingId, setEditingId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadMenu()
  }, [])

  async function loadMenu() {
    try {
      const data = await gql(`
        query AdminMenu {
          menuCategories { id name }
          menuDishes { ${DISH_FIELDS} }
        }
      `)

      setCategories(data.menuCategories)
      setDishes(data.menuDishes)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setReady(true)
    }
  }

  async function run(action, successMessage) {
    setBusy(true)
    setMessage('')
    setError('')

    try {
      await action()
      setMessage(successMessage)
      await loadMenu()
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  function addCategory(event) {
    event.preventDefault()

    const name = newCategory.trim()

    if (!name) {
      return
    }

    run(
      () =>
        gql(
          `mutation ($name: String!) { createMenuCategory(name: $name) { id } }`,
          { name }
        ),
      `Categoría "${name}" creada.`
    ).then((ok) => ok && setNewCategory(''))
  }

  function renameCategory(category) {
    const name = window.prompt('Nuevo nombre de la categoría', category.name)

    if (!name || name.trim() === category.name) {
      return
    }

    run(
      () =>
        gql(
          `mutation ($id: ID!, $name: String!) { updateMenuCategory(id: $id, name: $name) { id } }`,
          { id: category.id, name: name.trim() }
        ),
      'Categoría actualizada.'
    )
  }

  function deleteCategory(category) {
    if (!window.confirm(`¿Eliminar la categoría "${category.name}"?`)) {
      return
    }

    run(
      () =>
        gql(`mutation ($id: ID!) { deleteMenuCategory(id: $id) }`, {
          id: category.id,
        }),
      'Categoría eliminada.'
    )
  }

  function openCreate() {
    setDish({ ...EMPTY_DISH, categoryId: filter || categories[0]?.id || '' })
    setEditingId(null)
    setModalOpen(true)
  }

  function openEdit(item) {
    setDish({
      name: item.name,
      description: item.description || '',
      price: item.price,
      categoryId: item.categoryId,
      available: item.available,
    })
    setEditingId(item.id)
    setModalOpen(true)
  }

  function dishInput(values) {
    return {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      price: Number(values.price),
      categoryId: Number(values.categoryId),
      available: Boolean(values.available),
    }
  }

  async function saveDish(event) {
    event.preventDefault()

    const ok = await run(
      () =>
        editingId
          ? gql(
              `mutation ($id: ID!, $input: DishInput!) { updateDish(id: $id, input: $input) { id } }`,
              { id: editingId, input: dishInput(dish) }
            )
          : gql(
              `mutation ($input: DishInput!) { createDish(input: $input) { id } }`,
              { input: dishInput(dish) }
            ),
      editingId ? 'Platillo actualizado.' : 'Platillo agregado.'
    )

    if (ok) {
      setModalOpen(false)
    }
  }

  function toggleAvailable(item) {
    run(
      () =>
        gql(
          `mutation ($id: ID!, $input: DishInput!) { updateDish(id: $id, input: $input) { id } }`,
          {
            id: item.id,
            input: dishInput({ ...item, available: !item.available }),
          }
        ),
      item.available
        ? `"${item.name}" marcado como no disponible.`
        : `"${item.name}" marcado como disponible.`
    )
  }

  function deleteDish(item) {
    if (!window.confirm(`¿Eliminar el platillo "${item.name}"?`)) {
      return
    }

    run(
      () => gql(`mutation ($id: ID!) { deleteDish(id: $id) }`, { id: item.id }),
      'Platillo eliminado.'
    )
  }

  const visibleDishes = filter
    ? dishes.filter((item) => String(item.categoryId) === String(filter))
    : dishes

  return (
    <>
      <section className="simple-heading">
        <div>
          <h1>Menú del restaurante</h1>
          <p>
            Categorías y platillos del restaurante del hotel. Se guardan en el
            servicio de menú del sistema del restaurante.
          </p>
        </div>

        <button
          className="simple-button"
          onClick={openCreate}
          disabled={categories.length === 0}
          title={
            categories.length === 0 ? 'Crea una categoría primero' : undefined
          }
        >
          Agregar platillo
        </button>
      </section>

      {message && <div className="simple-message success">{message}</div>}
      {error && <div className="simple-message error">{error}</div>}

      <section className="simple-table-card category-card">
        <div className="category-heading">
          <h2>Categorías</h2>

          <form className="inline-form" onSubmit={addCategory}>
            <input
              placeholder="Nueva categoría, p. ej. Desayunos"
              value={newCategory}
              maxLength={150}
              onChange={(event) => setNewCategory(event.target.value)}
            />
            <button className="simple-button" disabled={busy}>
              Agregar
            </button>
          </form>
        </div>

        {ready && categories.length === 0 ? (
          <p className="simple-empty">
            Aún no hay categorías. Crea una para empezar a agregar platillos.
          </p>
        ) : (
          <div className="category-chips">
            <button
              className={`category-chip ${filter === '' ? 'active' : ''}`}
              onClick={() => setFilter('')}
            >
              Todas ({dishes.length})
            </button>

            {categories.map((category) => (
              <span
                key={category.id}
                className={`category-chip ${
                  String(filter) === String(category.id) ? 'active' : ''
                }`}
              >
                <button onClick={() => setFilter(String(category.id))}>
                  {category.name} (
                  {
                    dishes.filter(
                      (item) => String(item.categoryId) === String(category.id)
                    ).length
                  }
                  )
                </button>
                <button
                  className="chip-action"
                  title="Renombrar"
                  aria-label={`Renombrar ${category.name}`}
                  onClick={() => renameCategory(category)}
                >
                  ✎
                </button>
                <button
                  className="chip-action"
                  title="Eliminar"
                  aria-label={`Eliminar ${category.name}`}
                  onClick={() => deleteCategory(category)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="simple-table-card">
        <table>
          <thead>
            <tr>
              <th>Platillo</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Disponible</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {!ready ? (
              <tr>
                <td colSpan="5" className="simple-empty">
                  Cargando menú...
                </td>
              </tr>
            ) : visibleDishes.length === 0 ? (
              <tr>
                <td colSpan="5" className="simple-empty">
                  No hay platillos registrados.
                </td>
              </tr>
            ) : (
              visibleDishes.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.name}</strong>
                    {item.description && (
                      <small className="cell-note">{item.description}</small>
                    )}
                  </td>
                  <td>{item.category}</td>
                  <td>{money(item.price)}</td>
                  <td>
                    <button
                      className={`simple-status ${
                        item.available ? 'available' : 'inactive'
                      } status-toggle`}
                      disabled={busy}
                      title="Cambiar disponibilidad"
                      onClick={() => toggleAvailable(item)}
                    >
                      {item.available ? 'Disponible' : 'No disponible'}
                    </button>
                  </td>
                  <td>
                    <div className="simple-actions">
                      <button
                        className="simple-link"
                        onClick={() => openEdit(item)}
                      >
                        Editar
                      </button>
                      <button
                        className="simple-danger"
                        onClick={() => deleteDish(item)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {modalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setModalOpen(false)
          }
        >
          <form className="room-modal" onSubmit={saveDish}>
            <div className="modal-header">
              <h2>{editingId ? 'Editar platillo' : 'Agregar platillo'}</h2>
              <button
                type="button"
                className="simple-link"
                onClick={() => setModalOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <label>
              Nombre
              <input
                required
                maxLength={150}
                value={dish.name}
                onChange={(event) =>
                  setDish({ ...dish, name: event.target.value })
                }
              />
            </label>

            <div className="modal-row">
              <label>
                Precio
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={dish.price}
                  onChange={(event) =>
                    setDish({ ...dish, price: event.target.value })
                  }
                />
              </label>

              <label>
                Categoría
                <select
                  required
                  value={dish.categoryId}
                  onChange={(event) =>
                    setDish({ ...dish, categoryId: event.target.value })
                  }
                >
                  <option value="">Selecciona una categoría</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Descripción
              <textarea
                value={dish.description}
                onChange={(event) =>
                  setDish({ ...dish, description: event.target.value })
                }
              />
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={dish.available}
                onChange={(event) =>
                  setDish({ ...dish, available: event.target.checked })
                }
              />
              Disponible para los huéspedes
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="simple-link"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button className="simple-button" disabled={busy}>
                {busy ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}

export default AdminMenu
