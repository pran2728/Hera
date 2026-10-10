import { useState } from 'react'
import { Logo } from '../App.jsx'
import { acceptInvite } from '../lib/partner'

// Shown once, right after a partner signs in from an invite link.
export default function JoinPartner({ code, onJoined, onSkip }) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function join(e) {
    e.preventDefault()
    setBusy(true); setError('')
    const r = await acceptInvite(code, name.trim())
    setBusy(false)
    if (r.error) setError(r.error)
    else onJoined(r.herName)
  }

  return (
    <main className="center-page">
      <Logo size={64} />
      <h1>You've been invited 💜</h1>
      <p className="muted">
        Someone you love uses Hera for her cycle. As her partner, you'll get a heads-up before her period
        and simple tips on how to show up for her. You'll never see her chats, logs or symptoms.
      </p>
      <form className="card" onSubmit={join}>
        <label>
          Your first name
          <input value={name} onChange={e => setName(e.target.value)} maxLength={40} required
                 autoComplete="given-name" placeholder="e.g. Arjun" />
        </label>
        <p className="hint">She'll see this name in her settings.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy || !name.trim()}>{busy ? 'Joining…' : 'Join as her partner'}</button>
      </form>
      <button className="link" onClick={onSkip}>Not now</button>
    </main>
  )
}
