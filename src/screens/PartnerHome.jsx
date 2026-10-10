import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Logo } from '../App.jsx'
import { NotificationsSwitch } from './Reminders.jsx'

const PHASE_CLASS = { menstrual: 'menstrual', follicular: 'follicular', ovulatory: 'ovulatory', luteal: 'luteal', pms: 'luteal' }

// What a partner sees: her phase and one tip. Nothing she logged or said.
export default function PartnerHome({ session, onUseForMe }) {
  const [view, setView] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setError('')
    supabase.functions.invoke('hera-nudge', { body: { action: 'partner_view' } }).then(({ data, error }) => {
      if (error || !data) setError("Couldn't load right now. Check your internet and try again.")
      else setView(data)
    })
  }, [attempt])

  async function leave() {
    if (!confirm(`Stop being ${view?.her_name ?? 'her'}'s partner on Hera? You'll stop getting nudges.`)) return
    await supabase.from('partner_links').delete().eq('partner_id', session.user.id)
    setAttempt(a => a + 1)
  }

  const her = view?.her_name ?? 'her'
  const on = view?.nudges ?? {}

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand"><Logo size={32} /> Hera</div>
        <span className="partner-badge">Partner</span>
      </header>

      <main className="cycle-page">
        {error && (
          <section className="card">
            <p className="error" role="alert">{error}</p>
            <button className="primary" onClick={() => setAttempt(a => a + 1)}>Try again</button>
          </section>
        )}

        {!view && !error && <section className="card"><p className="muted">Loading…</p></section>}

        {view && !view.linked && (
          <section className="card">
            <h2>You're not connected</h2>
            <p className="muted small">Ask her to send you a new invite from Hera → My profile → Partner, then open the link on this phone.</p>
          </section>
        )}

        {view?.linked && (
          <>
            <section className="card partner-hero">
              <p className="eyebrow">{her}'s week</p>
              {view.phase
                ? <>
                    <span className={`phase ${PHASE_CLASS[view.phase]}`}>{view.phase_label}</span>
                    <p className="tip">{view.about}</p>
                  </>
                : <p className="tip">Every week is different. Ask her how she's doing, and really listen.</p>}
            </section>

            <section className="card">
              <h2>Today's tip for you</h2>
              <p className="partner-tip">{view.tip}</p>
            </section>

            <section className="card">
              <h2>Your nudges</h2>
              <p className="muted small">Turn on notifications so these reach you. {her} chooses which ones you get.</p>
              <NotificationsSwitch userId={session.user.id} />
              <ul className="nudge-list">
                <li className={on.heads_up ? '' : 'off'}>🗓️ A heads-up 2 days before her period</li>
                <li className={on.tips ? '' : 'off'}>💡 A weekly tip on how to support her</li>
                <li className={on.crisis ? '' : 'off'}>💜 A "please check on her" alert if she's having a really hard time</li>
              </ul>
            </section>

            <p className="muted small privacy-note">
              🔒 You'll never see {her}'s chats, logs or symptoms. She can turn partner mode off at any time.
            </p>
          </>
        )}

        <section className="card">
          <h2>Account</h2>
          <p className="muted small">Signed in as {session.user.email}</p>
          {view?.linked && <button type="button" className="link left" onClick={leave}>Stop being her partner</button>}
          <button type="button" className="link left" onClick={onUseForMe}>Use Hera for my own cycle</button>
          <button type="button" className="link left" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </section>
      </main>
    </div>
  )
}
