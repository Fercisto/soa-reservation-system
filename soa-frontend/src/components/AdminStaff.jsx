import { useEffect, useState } from 'react'
import { roleLabel, shiftLabel } from '../utils/restaurant.js'

const EMPTY_EMPLOYEE = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: '',
  shift: '',
  hireDate: '',
  active: true,
}

const EMPLOYEE_FIELDS = `
  id
  firstName
  lastName
  email
  phone
  role
  shift
  active
  hireDate
`

/**
 * Hotel staff and shifts, stored in the restaurant system's
 * employee-service and reached through Nest.
 */
function AdminStaff({ gql }) {
  const [employees, setEmployees] = useState([])
  const [roles, setRoles] = useState([])
  const [shifts, setShifts] = useState([])
  const [filters, setFilters] = useState({ role: '', shift: '' })
  const [ready, setReady] = useState(false)
  const [employee, setEmployee] = useState(EMPTY_EMPLOYEE)
  const [editingId, setEditingId] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadCatalogs()
  }, [])

  useEffect(() => {
    loadEmployees()
  }, [filters.role, filters.shift])

  async function loadCatalogs() {
    try {
      const data = await gql(`
        query StaffCatalogs {
          employeeRoles
          employeeShifts
        }
      `)

      setRoles(data.employeeRoles)
      setShifts(data.employeeShifts)
    } catch (err) {
      setError(err.message)
    }
  }

  async function loadEmployees() {
    try {
      const data = await gql(
        `
        query Staff($role: String, $shift: String) {
          employees(role: $role, shift: $shift) { ${EMPLOYEE_FIELDS} }
        }
      `,
        {
          role: filters.role || null,
          shift: filters.shift || null,
        }
      )

      setEmployees(data.employees)
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
      await loadEmployees()
      return true
    } catch (err) {
      setError(err.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  function openCreate() {
    setEmployee({
      ...EMPTY_EMPLOYEE,
      role: roles.includes('RECEPTIONIST') ? 'RECEPTIONIST' : roles[0] || '',
      shift: shifts[0] || '',
      hireDate: new Date().toISOString().slice(0, 10),
    })
    setEditingId(null)
    setModalOpen(true)
  }

  function openEdit(item) {
    setEmployee({
      firstName: item.firstName,
      lastName: item.lastName,
      email: item.email,
      phone: item.phone || '',
      role: item.role,
      shift: item.shift,
      hireDate: item.hireDate || '',
      active: item.active,
    })
    setEditingId(item.id)
    setModalOpen(true)
  }

  function employeeInput(values) {
    return {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
      phone: values.phone?.trim() || null,
      role: values.role,
      shift: values.shift,
      hireDate: values.hireDate || null,
      active: Boolean(values.active),
    }
  }

  async function saveEmployee(event) {
    event.preventDefault()

    const ok = await run(
      () =>
        editingId
          ? gql(
              `mutation ($id: ID!, $input: EmployeeInput!) { updateEmployee(id: $id, input: $input) { id } }`,
              { id: editingId, input: employeeInput(employee) }
            )
          : gql(
              `mutation ($input: EmployeeInput!) { createEmployee(input: $input) { id } }`,
              { input: employeeInput(employee) }
            ),
      editingId ? 'Empleado actualizado.' : 'Empleado registrado.'
    )

    if (ok) {
      setModalOpen(false)
    }
  }

  function toggleActive(item) {
    run(
      () =>
        gql(
          `mutation ($id: ID!, $input: EmployeeInput!) { updateEmployee(id: $id, input: $input) { id } }`,
          {
            id: item.id,
            input: employeeInput({ ...item, active: !item.active }),
          }
        ),
      item.active
        ? `${item.firstName} ${item.lastName} quedó inactivo.`
        : `${item.firstName} ${item.lastName} quedó activo.`
    )
  }

  function deleteEmployee(item) {
    if (
      !window.confirm(`¿Eliminar a ${item.firstName} ${item.lastName}?`)
    ) {
      return
    }

    run(
      () =>
        gql(`mutation ($id: ID!) { deleteEmployee(id: $id) }`, {
          id: item.id,
        }),
      'Empleado eliminado.'
    )
  }

  const shiftCounts = shifts.map((shift) => ({
    shift,
    count: employees.filter((item) => item.shift === shift && item.active)
      .length,
  }))

  return (
    <>
      <section className="simple-heading">
        <div>
          <h1>Personal y turnos</h1>
          <p>
            Personal del hotel y su turno. Se guarda en el servicio de
            personal del sistema del restaurante.
          </p>
        </div>

        <button
          className="simple-button"
          onClick={openCreate}
          disabled={roles.length === 0 || shifts.length === 0}
        >
          Registrar empleado
        </button>
      </section>

      {message && <div className="simple-message success">{message}</div>}
      {error && <div className="simple-message error">{error}</div>}

      {shifts.length > 0 && (
        <section className="shift-summary">
          {shiftCounts.map(({ shift, count }) => (
            <button
              key={shift}
              className={`shift-tile ${
                filters.shift === shift ? 'active' : ''
              }`}
              onClick={() =>
                setFilters({
                  ...filters,
                  shift: filters.shift === shift ? '' : shift,
                })
              }
            >
              <span>{shiftLabel(shift)}</span>
              <strong>{filters.shift && filters.shift !== shift ? '–' : count}</strong>
              <small>activos</small>
            </button>
          ))}
        </section>
      )}

      <section className="simple-table-card">
        <div className="table-filters">
          <label>
            Puesto
            <select
              value={filters.role}
              onChange={(event) =>
                setFilters({ ...filters, role: event.target.value })
              }
            >
              <option value="">Todos</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Turno
            <select
              value={filters.shift}
              onChange={(event) =>
                setFilters({ ...filters, shift: event.target.value })
              }
            >
              <option value="">Todos</option>
              {shifts.map((shift) => (
                <option key={shift} value={shift}>
                  {shiftLabel(shift)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Puesto</th>
              <th>Turno</th>
              <th>Contacto</th>
              <th>Ingreso</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {!ready ? (
              <tr>
                <td colSpan="7" className="simple-empty">
                  Cargando personal...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan="7" className="simple-empty">
                  No hay empleados registrados
                  {filters.role || filters.shift ? ' con esos filtros' : ''}.
                </td>
              </tr>
            ) : (
              employees.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>
                      {item.firstName} {item.lastName}
                    </strong>
                  </td>
                  <td>{roleLabel(item.role)}</td>
                  <td>{shiftLabel(item.shift)}</td>
                  <td>
                    {item.email}
                    {item.phone && (
                      <small className="cell-note">{item.phone}</small>
                    )}
                  </td>
                  <td>{item.hireDate || '—'}</td>
                  <td>
                    <button
                      className={`simple-status ${
                        item.active ? 'available' : 'inactive'
                      } status-toggle`}
                      disabled={busy}
                      title="Cambiar estado"
                      onClick={() => toggleActive(item)}
                    >
                      {item.active ? 'Activo' : 'Inactivo'}
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
                        onClick={() => deleteEmployee(item)}
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
          <form className="room-modal" onSubmit={saveEmployee}>
            <div className="modal-header">
              <h2>{editingId ? 'Editar empleado' : 'Registrar empleado'}</h2>
              <button
                type="button"
                className="simple-link"
                onClick={() => setModalOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="modal-row">
              <label>
                Nombre
                <input
                  required
                  value={employee.firstName}
                  onChange={(event) =>
                    setEmployee({ ...employee, firstName: event.target.value })
                  }
                />
              </label>
              <label>
                Apellidos
                <input
                  required
                  value={employee.lastName}
                  onChange={(event) =>
                    setEmployee({ ...employee, lastName: event.target.value })
                  }
                />
              </label>
            </div>

            <div className="modal-row">
              <label>
                Correo
                <input
                  required
                  type="email"
                  value={employee.email}
                  onChange={(event) =>
                    setEmployee({ ...employee, email: event.target.value })
                  }
                />
              </label>
              <label>
                Teléfono
                <input
                  value={employee.phone}
                  onChange={(event) =>
                    setEmployee({ ...employee, phone: event.target.value })
                  }
                />
              </label>
            </div>

            <div className="modal-row">
              <label>
                Puesto
                <select
                  required
                  value={employee.role}
                  onChange={(event) =>
                    setEmployee({ ...employee, role: event.target.value })
                  }
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {roleLabel(role)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Turno
                <select
                  required
                  value={employee.shift}
                  onChange={(event) =>
                    setEmployee({ ...employee, shift: event.target.value })
                  }
                >
                  {shifts.map((shift) => (
                    <option key={shift} value={shift}>
                      {shiftLabel(shift)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Fecha de ingreso
              <input
                type="date"
                value={employee.hireDate}
                onChange={(event) =>
                  setEmployee({ ...employee, hireDate: event.target.value })
                }
              />
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={employee.active}
                onChange={(event) =>
                  setEmployee({ ...employee, active: event.target.checked })
                }
              />
              Empleado activo
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

export default AdminStaff
