import { useEffect, useMemo, useState } from 'react'
import { supabase, withRetry } from '../lib/supabase'
import { localToday } from '../lib/dates'
import { computeCycle, daysBetween, addDays, PHASE_LABELS } from '../lib/cycle'
import { pregnancyGuide } from '../lib/stages'
import { lineFor } from '../lib/quotes'
import { dailyTip } from '../lib/nudges'
import { quickItems, quickLog, undoLog, logLabel } from '../lib/quicklog'
import { PodcastCard } from './PatternCards.jsx'
import { StoryRow, StoryViewer } from './Stories.jsx'
import { storiesFor } from '../lib/stories'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const short = d => `${Number(d.slice(8))} ${MON[Number(d.slice(5, 7)) - 1]}`

function greetingFor(name) {
  const h = new Date().getHours()
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${part}${name ? `, ${name.split(' ')[0]}` : ''}`
}

// The hero: where she is today, in one glance.
function Hero({ cycle, profile, today }) {
  if (cycle.mode === 'pregnant' && cycle.pregnancy) {
    const w = cycle.pregnancy, g = pregnancyGuide(w)
    return (
      <HeroShell tint="pregnant" ring={[Math.min(280 - w.toGo, 280), 280]} big={`Week ${w.week}`} small={`day ${w.day}`}
        kicker={`Trimester ${w.trimester}`} title={w.toGo > 0 ? `${w.toGo} days to go` : 'Any day now'}
        sub={`Baby is about the size of ${g.size}.`} />
    )
  }
  if (cycle.mode === 'pregnant') return <HeroShell tint="pregnant" kicker="Pregnancy mode" title="Welcome, mama-to-be" sub="Add your due date in Me and I'll follow along week by week." />
  if (cycle.mode === 'menopause') return <HeroShell tint="luteal" kicker="Menopause mode" title="Your body, your pace" sub="Log hot flushes, sleep and mood below. I'll spot the patterns." />
  if (cycle.mode === 'no_phases') return <HeroShell tint="follicular" kicker="Tracking bleeding and symptoms" title="No phases to predict" sub={`You're on ${cycle.reason}. Log anything below.`} />
  if (cycle.mode === 'unknown') return <HeroShell tint="follicular" kicker="Let's get started" title="When did your last period start?" sub="Tap Period started below on the day it comes, or tell Hera in chat." />
  if (cycle.phase === 'late') {
    return <HeroShell tint="late" ring={[1, 1]} big={`Day ${cycle.day}`} small="" kicker="Your period is late"
      title={`${cycle.lateBy} days later than expected`} sub="Stress, travel and illness can all shift a cycle. If it's possible you're pregnant, a test can help." />
  }
  const until = daysBetween(today, cycle.nextPeriod.from)
  const label = cycle.lateLuteal ? 'PMS days' : PHASE_LABELS[cycle.phase]
  const title = cycle.phase === 'menstrual'
    ? `Period day ${cycle.day}`
    : until > 1 ? `Period in ${until} days` : until === 1 ? 'Period from tomorrow' : 'Period could start any day'
  const sub = cycle.phase === 'menstrual'
    ? `Next one around ${short(cycle.nextPeriod.expected)}.`
    : profile.life_stage === 'ttc' || cycle.phase === 'follicular' || cycle.phase === 'ovulatory'
      ? `Fertile window ${short(cycle.fertileWindow.from)} – ${short(cycle.fertileWindow.to)} (estimate).`
      : `Expected ${short(cycle.nextPeriod.from)} – ${short(cycle.nextPeriod.to)}.`
  return <HeroShell tint={cycle.lateLuteal ? 'pms' : cycle.phase} ring={[cycle.day, cycle.cycleLength]}
    big={`Day ${cycle.day}`} small={`of ${cycle.cycleLength}`} kicker={label} title={title} sub={sub} />
}

function HeroShell({ tint, ring, big, small, kicker, title, sub }) {
  return (
    <section className={`today-hero tint-${tint}`}>
      {ring && <BigRing value={ring[0]} total={ring[1]} big={big} small={small} />}
      <div className="hero-text">
        <span className="hero-kicker">{kicker}</span>
        <h2 className="hero-title">{title}</h2>
        <p className="hero-sub">{sub}</p>
      </div>
    </section>
  )
}

function BigRing({ value, total, big, small }) {
  const r = 52, c = 2 * Math.PI * r
  const done = Math.max(0, Math.min(value / total, 1))
  return (
    <svg className="big-ring" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label={`${big} ${small}`}>
      <circle cx="64" cy="64" r={r} className="big-ring-track" />
      <circle cx="64" cy="64" r={r} className="big-ring-fill" strokeDasharray={`${c * done} ${c}`} transform="rotate(-90 64 64)" />
      <text x="64" y="62" textAnchor="middle" className="big-ring-day">{big}</text>
      {small && <text x="64" y="82" textAnchor="middle" className="big-ring-of">{small}</text>}
    </svg>
  )
}

export default function Today({ session, profile, onProfileChange, active, onTalk, onLogged }) {
  const today = localToday()
  const userId = session.user.id
  const [logs, setLogs] = useState(null)
  const [error, setError] = useState('')
  const [picking, setPicking] = useState(null) // an item that needs a level (cramps, sex drive)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [story, setStory] = useState(null) // which story is open
  const [seenV, setSeenV] = useState(0)

  async function load() {
    const { data, error } = await withRetry(() => supabase.from('cycle_logs').select('id, log_date, kind, value, created_at')
      .gte('log_date', addDays(today, -200)).order('log_date', { ascending: false }).order('created_at', { ascending: false }).limit(400))
    if (error) setError(error.message); else { setLogs(data); setError('') }
  }
  useEffect(() => { if (active) load() }, [active, userId])

  const cycle = useMemo(() => logs && computeCycle(profile, logs.filter(l => l.kind === 'period_start').map(l => l.log_date), today), [logs, profile, today])
  const todays = (logs ?? []).filter(l => l.log_date === today)

  async function log(item, value) {
    if (busy) return
    setBusy(true); setPicking(null)
    try {
      const v = value ?? item.value
      const { log: saved, profile: p } = await quickLog(userId, profile, item.kind, v, today)
      if (p) onProfileChange(p)
      setToast(`Logged: ${logLabel(saved)}`)
      await load(); onLogged?.()
    } catch (e) {
      setToast(/check constraint/i.test(e.message) ? 'That needs the latest database update.' : "Couldn't save that. Try again?")
    }
    setBusy(false)
    setTimeout(() => setToast(''), 2500)
  }

  async function undo(l) {
    const p = await undoLog(l, profile, userId, logs)
    if (p) onProfileChange(p)
    await load(); onLogged?.()
  }

  if (error) return <main className="cycle-page"><p className="error" role="alert">{error}</p><button className="primary" onClick={load}>Try again</button></main>
  if (!cycle) return <main className="cycle-page"><div className="bubble hera typing"><span /><span /><span /></div></main>

  const items = quickItems(profile, cycle)
  const stories = storiesFor(profile, cycle, today)
  return (
    <main className="cycle-page today">
      <p className="today-hello">{greetingFor(profile.name)}</p>
      <StoryRow stories={stories} today={today} onOpen={setStory} version={seenV} />
      {story !== null && (
        <StoryViewer stories={stories} start={story} today={today}
                     onClose={() => { setStory(null); setSeenV(v => v + 1) }}
                     onAnswer={async (kind, value) => { await log({ kind }, value) }} />
      )}
      <Hero cycle={cycle} profile={profile} today={today} />

      <section className="card thought">
        <span className="hero-kicker">Today's thought</span>
        <p className="thought-line">{lineFor(profile, cycle, today)}</p>
      </section>

      <section className="card">
        <h2>How are you today?</h2>
        <div className="quick" role="group" aria-label="Quick log">
          {items.map(it => (
            <button key={it.id} type="button" className={`chip quick-chip ${picking?.id === it.id ? 'on' : ''}`} disabled={busy}
                    onClick={() => it.pick ? setPicking(picking?.id === it.id ? null : it) : log(it)}>{it.label}</button>
          ))}
        </div>
        {picking && (
          <div className="quick-pick" role="group" aria-label={`${picking.label} level`}>
            <span className="muted small">{picking.label}:</span>
            {picking.pick.map(([label, v]) => <button key={v} type="button" className="chip small" onClick={() => log(picking, v)}>{label}</button>)}
          </div>
        )}
        {toast && <p className="notice" role="status">✓ {toast}</p>}
        {todays.length > 0 && (
          <div className="logged-today">
            <span className="muted small">Today:</span>
            {todays.map(l => (
              <span key={l.id} className="tag">{logLabel(l)}
                <button type="button" className="tag-x" onClick={() => undo(l)} aria-label={`Remove ${logLabel(l)}`}>×</button>
              </span>
            ))}
          </div>
        )}
        <button type="button" className="link left" onClick={onTalk}>Want to say more? Talk to Hera →</button>
      </section>

      <section className="card">
        <h2>Today's tip</h2>
        <p className="tip">{dailyTip(profile, cycle, today)}</p>
      </section>

      {profile.podcast_picks !== false && <PodcastCard profile={profile} cycle={cycle} today={today} />}
    </main>
  )
}

