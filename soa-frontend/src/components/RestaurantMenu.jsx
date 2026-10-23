import { useEffect, useState } from 'react'
import { money } from '../utils/reservation.js'

/**
 * Hotel restaurant menu for guests: available dishes grouped by category.
 * The menu is managed by admins and stored in the restaurant system's menu-service.
 */
function RestaurantMenu({ gql }) {
  const [categories, setCategories] = useState([])
  const [dishes, setDishes] = useState([])
  const [selected, setSelected] = useState('')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    gql(`
      query RestaurantMenu {
        menuCategories { id name }
        menuDishes { id name description price categoryId available }
      }
    `)
      .then((data) => {
        setCategories(data.menuCategories)
        setDishes(data.menuDishes.filter((dish) => dish.available))
      })
      .catch((err) => setError(err.message))
      .finally(() => setReady(true))
  }, [])

  const groups = categories
    .filter((category) => !selected || String(category.id) === selected)
    .map((category) => ({
      category,
      dishes: dishes.filter(
        (dish) => String(dish.categoryId) === String(category.id)
      ),
    }))
    .filter((group) => group.dishes.length > 0)

  return (
    <section className="restaurant-menu">
      <div className="simple-heading">
        <div>
          <h1>Restaurante</h1>
          <p>Menú del restaurante del hotel y servicio a la habitación.</p>
        </div>

        {categories.length > 1 && (
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            aria-label="Filtrar por categoría"
          >
            <option value="">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!ready ? (
        <p className="simple-empty">Cargando menú...</p>
      ) : error ? (
        <p className="simple-empty">
          El menú no está disponible en este momento.
        </p>
      ) : groups.length === 0 ? (
        <p className="simple-empty">Aún no hay platillos disponibles.</p>
      ) : (
        groups.map(({ category, dishes: items }) => (
          <div key={category.id} className="menu-group">
            <h3>{category.name}</h3>

            <ul>
              {items.map((dish) => (
                <li key={dish.id}>
                  <div>
                    <strong>{dish.name}</strong>
                    {dish.description && <span>{dish.description}</span>}
                  </div>
                  <b>{money(dish.price)}</b>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}

export default RestaurantMenu
