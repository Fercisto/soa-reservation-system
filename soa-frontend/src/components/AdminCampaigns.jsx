import { useEffect, useState } from 'react'
import { formatDateTime } from '../utils/saas.js'

const AUDIENCES = [
  { id: 'upcoming', label: 'Con estancia próxima o en curso' },
  { id: 'past', label: 'Que ya se hospedaron' },
  { id: 'all', label: 'Todos los huéspedes' },
]

const EMPTY_CAMPAIGN = { audience: 'all', title: '', message: '' }

/**
 * Messages to the hotel's guests, delivered to their notification bell.
 * Open while the hotel has a time pass.
 */
function AdminCampaigns({ gql }) {
  const [overview, setOverview] = useState(null)
  const [campaign, setCampaign] = useState(EMPTY_CAMPAIGN)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    try {
      const data = await gql(`
        query Campaigns {
          campaigns {
            audiences
            campaigns { id audience title message recipients created_at user { id name } }
          }
        }
      `)
      setOverview(data.campaigns)
    } catch (err) {
      setError(err.message)
    }
  }

  async function send(event) {
    event.preventDefault()
    const recipients = overview?.audiences?.[campaign.audience] ?? 0

    if (!window.confirm(`Se enviará a ${recipients} huéspedes. ¿Continuar?`)) {
      return
    }

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const data = await gql(
        `mutation SendCampaign($input: CampaignInput!) {
          sendCampaign(input: $input) { id recipients }
        }`,
        { input: campaign }
      )

      setMessage(`Campaña enviada a ${data.sendCampaign.recipients} huéspedes.`)
      setCampaign(EMPTY_CAMPAIGN)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const audienceLabel = (id) => AUDIENCES.find((item) => item.id === id)?.label || id

  return (
    <>
      <section className="simple-heading">
        <div>
          <h1>Campañas a huéspedes</h1>
          <p>
            Envía avisos y promociones a la campana de notificaciones de tus
            huéspedes.
          </p>
        </div>
      </section>

      {message && <div className="simple-message success">{message}</div>}
      {error && <div className="simple-message error">{error}</div>}

      <form className="campaign-form" onSubmit={send}>
        <fieldset className="campaign-audiences">
          <legend>Para quién</legend>
          {AUDIENCES.map((audience) => (
            <label key={audience.id} className="checkbox-label">
              <input
                type="radio"
                name="audience"
                value={audience.id}
                checked={campaign.audience === audience.id}
                onChange={() => setCampaign({ ...campaign, audience: audience.id })}
              />
              {audience.label}
              <b>{overview?.audiences?.[audience.id] ?? '…'}</b>
            </label>
          ))}
        </fieldset>

        <label>
          Título
          <input
            required
            maxLength={120}
            placeholder="20% de descuento en tu próxima estancia"
            value={campaign.title}
            onChange={(event) => setCampaign({ ...campaign, title: event.target.value })}
          />
        </label>

        <label>
          Mensaje
          <textarea
            required
            maxLength={1000}
            value={campaign.message}
            onChange={(event) => setCampaign({ ...campaign, message: event.target.value })}
          />
        </label>

        <button className="simple-button" disabled={busy}>
          {busy ? 'Enviando...' : 'Enviar campaña'}
        </button>
      </form>

      <section className="simple-table-card">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Campaña</th>
              <th>Para</th>
              <th className="num">Huéspedes</th>
            </tr>
          </thead>
          <tbody>
            {!overview || overview.campaigns.length === 0 ? (
              <tr>
                <td colSpan="4" className="simple-empty">
                  Todavía no has enviado campañas.
                </td>
              </tr>
            ) : (
              overview.campaigns.map((item) => (
                <tr key={item.id}>
                  <td>
                    {formatDateTime(item.created_at)}
                    <span className="cell-note">{item.user?.name}</span>
                  </td>
                  <td>
                    <strong>{item.title}</strong>
                    <span className="cell-note">{item.message}</span>
                  </td>
                  <td>{audienceLabel(item.audience)}</td>
                  <td className="num">{item.recipients}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </>
  )
}

export default AdminCampaigns
