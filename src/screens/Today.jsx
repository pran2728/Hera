import { useEffect, useMemo, useState } from 'react'
import { supabase, withRetry } from '../lib/supabase'
import { localToday } from '../lib/dates'
import { computeCycle, daysBetween, addDays, PHASE_LABELS } from '../lib/cycle'
import { pregnancyGuide, isBirthday } from '../lib/stages'
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

const LONG_DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
const LONG_MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']
function longDate(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  return `${LONG_DAYS[d.getUTCDay()]} · ${d.getUTCDate()} ${LONG_MONTHS[d.getUTCMonth()]}`
}

// Where she is today, as a ring of moons: one per day of her cycle (or week of pregnancy).
function moonHero(cycle, profile, today) {
  if (cycle.mode === 'pregnant' && cycle.pregnancy) {
    const w = cycle.pregnancy, g = pregnancyGuide(w)
    return { n: 40, at: Math.min(Math.max(w.week, 1), 40), period: 0, center: w.week,
      kicker: `WEEK ${w.week} · TRIMESTER ${w.trimester}`, title: w.toGo > 0 ? `${w.toGo} days to go` : 'Any day now',
      sub: `Baby is about the size of ${g.size}.`, label: `Week ${w.week} of 40` }
  }
  if (cycle.mode === 'pregnant') return { kicker: 'PREGNANCY MODE', title: 'Welcome, mama-to-be', sub: "Add your due date in Me and I'll follow along week by week." }
  if (cycle.mode === 'menopause') return { kicker: 'MENOPAUSE MODE', title: 'Your body, your pace', sub: "Log hot flushes, sleep and mood below. I'll spot the patterns." }
  if (cycle.mode === 'no_phases') return { kicker: 'TRACKING BLEEDING AND SYMPTOMS', title: 'No phases to predict', sub: `You're on ${cycle.reason}. Log anything below.` }
  if (cycle.mode === 'unknown') return { kicker: "LET'S BEGIN", title: 'When did your last period start?', sub: 'Tap Period started below on the day it comes, or tell Hera in chat.' }
  const n = Math.min(Math.max(cycle.cycleLength, 21), 45)
  if (cycle.phase === 'late') {
    return { n, at: n + 1, period: cycle.periodLength, center: cycle.day, kicker: `DAY ${cycle.day} · YOUR PERIOD IS LATE`,
      title: `${cycle.lateBy} days later than expected`, sub: 'Stress, travel and illness can all shift a cycle.', label: `Day ${cycle.day}, period late` }
  }
  const until = daysBetween(today, cycle.nextPeriod.from)
  const label = cycle.lateLuteal ? 'PMS DAYS' : PHASE_LABELS[cycle.phase].replace(' phase', '').toUpperCase()
  const title = cycle.phase === 'menstrual'
    ? `Period day ${cycle.day}`
    : until > 1 ? `Period in ${until} days` : until === 1 ? 'Period from tomorrow' : 'Period could start any day'
  const sub = cycle.phase === 'menstrual'
    ? `Next one around ${short(cycle.nextPeriod.expected)}`
    : profile.life_stage === 'ttc' || cycle.phase === 'follicular' || cycle.phase === 'ovulatory'
      ? `Fertile window ${short(cycle.fertileWindow.from)} – ${short(cycle.fertileWindow.to)} (estimate)`
      : `Expected ${short(cycle.nextPeriod.from)} – ${short(cycle.nextPeriod.to)}`
  return { n, at: cycle.day, period: cycle.periodLength, center: cycle.day, kicker: `DAY ${cycle.day} · ${label}`, title, sub,
    label: `Day ${cycle.day} of a ${cycle.cycleLength}-day cycle` }
}

function MoonRing({ n, at, period, center, label }) {
  const dots = []
  for (let i = 1; i <= (n || 0); i++) {
    const a = -Math.PI / 2 + (2 * Math.PI * (i - 1)) / n
    const x = 110 + 88 * Math.cos(a), y = 110 + 88 * Math.sin(a)
    if (i === at) {
      dots.push(<g key={i}><circle cx={x} cy={y} r="13" className="moon-halo" /><circle cx={x} cy={y} r="9.5" className="moon-today" /><circle cx={x + 3.3} cy={y - 3} r="8" className="moon-halo" /></g>)
    } else if (i < at) {
      dots.push(<circle key={i} cx={x} cy={y} r={i <= period ? 5.5 : 4.2} className={i <= period ? 'moon-period' : 'moon-passed'} />)
    } else {
      dots.push(<circle key={i} cx={x} cy={y} r="4.2" className="moon-future" />)
    }
  }
  return (
    <svg className="moon-ring" width="214" height="214" viewBox="0 0 220 220" role="img" aria-label={label || 'Hera'}>
      <circle cx="110" cy="110" r="100" className="moon-disc" />
      {dots}
      <circle cx="110" cy="110" r="46" className="moon-crescent" />
      <circle cx="128" cy="96" r="40" className="moon-disc" />
      {center !== undefined && <text x="130" y="108" textAnchor="middle" className="moon-num">{center}</text>}
    </svg>
  )
}

function Hero({ cycle, profile, today }) {
  const h = moonHero(cycle, profile, today)
  return (
    <section className="moon-hero">
      <MoonRing n={h.n} at={h.at} period={h.period} center={h.center} label={h.label} />
      <span className="small-caps">{h.kicker}</span>
      <h2 className="moon-title">{h.title}</h2>
      <p className="moon-sub">{h.sub}</p>
    </section>
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
      <header className="today-head">
        <svg width="30" height="30" viewBox="0 0 512 512" aria-hidden="true"><circle cx="256" cy="256" r="150" className="gold-fill" /><circle cx="310" cy="220" r="132" className="bg-fill" /></svg>
        <span className="small-caps">{longDate(today)}</span>
        <p className="today-hello">{isBirthday(profile.birth_date, today)
          ? `Happy birthday${profile.name ? `, ${profile.name.split(' ')[0]}` : ''} 🎂`
          : greetingFor(profile.name)}</p>
      </header>
      <StoryRow stories={stories} today={today} onOpen={setStory} version={seenV} />
      {story !== null && (
        <StoryViewer stories={stories} start={story} today={today}
                     onClose={() => { setStory(null); setSeenV(v => v + 1) }}
                     onAnswer={async (kind, value) => { await log({ kind }, value) }} />
      )}
      <Hero cycle={cycle} profile={profile} today={today} />

      <section className="thought" aria-label="Today's thought">
        <svg width="90" height="10" viewBox="0 0 90 10" aria-hidden="true"><path d="M0 5 H36 M54 5 H90" className="gold-stroke" /><path d="M45 0 L50 5 L45 10 L40 5 Z" className="gold-fill" /></svg>
        <p className="thought-line">{lineFor(profile, cycle, today)}</p>
      </section>

      <section className="quick-section">
        <h2 className="small-caps center">How are you today?</h2>
        <div className="quick" role="group" aria-label="Quick log">
          {items.map(it => (
            <button key={it.id} type="button" className={`chip quick-chip ${it.kind === 'period_start' || it.kind === 'period_end' ? 'key' : ''} ${picking?.id === it.id ? 'on' : ''}`} disabled={busy}
                    onClick={() => {
                      if (!it.pick) return log(it)
                      setPicking(picking?.id === it.id ? null : it)
                      setTimeout(() => document.querySelector('.quick-pick')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50)
                    }}>{it.label}</button>
          ))}
        </div>
        {picking && (
          <div className="quick-pick" role="group" aria-label={`${picking.label} level`}>
            <span className="muted small">{picking.id === 'drive' ? 'Your sex drive today:' : 'How bad?'}</span>
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
        <button type="button" className="link talk" onClick={onTalk}>Want to say more? Talk to Hera →</button>
      </section>

      <section className="card">
        <h2>Today's tip</h2>
        <p className="tip">{dailyTip(profile, cycle, today)}</p>
      </section>

      {profile.podcast_picks !== false && <PodcastCard profile={profile} cycle={cycle} today={today} />}
    </main>
  )
}

