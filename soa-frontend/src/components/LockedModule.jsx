/**
 * Placeholder for a module the hotel's plan does not include, or for every module
 * while the subscription is not active.
 */
function LockedModule({ title, plan, inactive, onOpenAccount }) {
  return (
    <section className="locked-module">
      <span className="lock-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path
            fill="currentColor"
            d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z"
          />
        </svg>
      </span>

      <h1>{title}</h1>

      <p>
        {inactive
          ? 'La suscripción de tu hotel no está activa. Renueva tu plan para volver a usar este módulo.'
          : `Este módulo está incluido a partir del plan ${plan?.name}.`}
      </p>

      <button className="simple-button" onClick={onOpenAccount}>
        {inactive ? 'Renovar mi plan' : `Ver plan ${plan?.name}`}
      </button>
    </section>
  )
}

export default LockedModule
