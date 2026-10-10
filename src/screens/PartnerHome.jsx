import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Logo } from '../App.jsx'
import { NotificationsSwitch } from './Reminders.jsx'
import ThemePicker from './ThemePicker.jsx'
import FeedbackSheet from './FeedbackSheet.jsx'
import { deleteAccount, openPrivacy } from '../lib/account'
import { monthGrid } from '../lib/calendar'
import { addDays, daysBetween } from '../lib/cycle'
import { localToday } from '../lib/dates'

const PHASE_CLASS = { menstrual: 'menstrual', follicular: 'follicular', ovulatory: 'ovulatory', luteal: 'luteal', pms: 'luteal' }

// What a partner sees: her phase and one tip. Nothing she logged or said.
export default function PartnerHome({ session, onUseForMe }) {
  const [view, setView] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [feedback, setFeedback] = useState(false)

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

            {view.next_period && <PartnerCalendar her={her} next={view.next_period} now={view.period_now} />}

            <section className="card">
              <h2>Today's tip for you</h2>
              <p className="partner-tip">{view.tip}</p>
            </section>

            <section className="card">
              <h2>Your nudges</h2>
              <p className="muted small">Turn on notifications so these reach you. {her} chooses which ones you get.</p>
              <NotificationsSwitch userId={session.user.id} />
              <ul className="nudge-list">
                <li className={on.heads_up ? '' : 'off'}>🔔 A heads-up 2 days before her period</li>
                <li className={on.dates ? '' : 'off'}>🗓️ Her next likely period on a calendar</li>
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
          <h2>Colour theme</h2>
          <ThemePicker />
        </section>

        <section className="card">
          <h2>Account</h2>
          <p className="muted small">Signed in as {session.user.email}</p>
          {view?.linked && <button type="button" className="link left" onClick={leave}>Stop being her partner</button>}
          <button type="button" className="link left" onClick={onUseForMe}>Use Hera for my own cycle</button>
          <button type="button" className="link left" onClick={() => setFeedback(true)}>Send feedback</button>
          <button type="button" className="link left" onClick={openPrivacy}>Privacy policy</button>
          <button type="button" className="link left" onClick={() => supabase.auth.signOut()}>Sign out</button>
          <button type="button" className="link left danger" onClick={async () => {
            if (prompt('Delete your Hera account? Type DELETE to confirm.')?.trim().toUpperCase() !== 'DELETE') return
            try { await deleteAccount() } catch (e) { setError(e.message) }
          }}>Delete my account</button>
          {feedback && <FeedbackSheet onClose={() => setFeedback(false)} />}
        </section>
      </main>
    </div>
  )
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const short = d => `${Number(d.slice(8))} ${MON[Number(d.slice(5, 7)) - 1]}`

function range(from, to) {
  const out = new Set()
  for (let d = from; d <= to; d = addDays(d, 1)) out.add(d)
  return out
}

// Her next likely period (and current one, if she's on it), for planning ahead.
function PartnerCalendar({ her, next, now }) {
  const today = localToday()
  const likely = range(next.from, next.to)
  const current = now ? range(now.from, now.to) : new Set()
  const until = daysBetween(today, next.from)
  // This month, plus the next one if her period falls there.
  const months = [[Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1]]
  const end = [Number(next.to.slice(0, 4)), Number(next.to.slice(5, 7)) - 1]
  if (end[0] !== months[0][0] || end[1] !== months[0][1]) months.push(end)
  return (
    <section className="card calendar">
      <h2>{her}'s next period</h2>
      <p className="partner-dates">{short(next.from)} – {short(next.to)}
        <span className="muted small"> · {until > 1 ? `in about ${until} days` : until === 1 ? 'from tomorrow' : 'any day now'}</span></p>
      {months.map(([y, m]) => (
        <div key={`${y}-${m}`}>
          <div className="cal-head"><strong>{MONTHS[m]} {y}</strong></div>
          <div className="cal-grid" role="grid">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
            {monthGrid(y, m).flat().map((d, i) => {
              if (!d) return <div key={i} />
              const cls = ['cal-day', current.has(d) && 'period', !current.has(d) && likely.has(d) && 'predicted', d === today && 'today'].filter(Boolean).join(' ')
              return <div key={i} className={cls} role="gridcell"
                          aria-label={[d, current.has(d) && 'period', likely.has(d) && 'likely period', d === today && 'today'].filter(Boolean).join(', ')}>{Number(d.slice(8))}</div>
            })}
          </div>
        </div>
      ))}
      <div className="legend">
        {now && <span><i className="sw period" /> Period now</span>}
        <span><i className="sw predicted" /> Likely period</span>
      </div>
      <p className="fine">An estimate{next.rough ? ', and a rough one for her cycles' : ''}. Plan ahead, but let her tell you how she's feeling.</p>
    </section>
  )
}
