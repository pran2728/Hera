import { useEffect, useMemo, useState } from 'react'
import { supabase, withRetry } from '../lib/supabase'
import { localToday } from '../lib/dates'
import { computeCycle, prettyDate, daysBetween, PHASE_LABELS } from '../lib/cycle'
import { periodDays, predictedDays, monthGrid, dayActions, periodEdit } from '../lib/calendar'
import { PatternsCard, PodcastCard } from './PatternCards.jsx'
import { PregnancyCard, WarningSigns, TtcCard, SymptomsCard, BonesCard, SexDriveCard, ReadMore } from './StageCards.jsx'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const LOG_LABELS = {
  period_start: 'Period started', period_end: 'Period ended', flow: 'Flow', pain: 'Pain',
  mood: 'Mood', energy: 'Energy', symptom: 'Symptom', sleep: 'Sleep', sex_drive: 'Sex drive', note: 'Note',
  hot_flash: 'Hot flush', night_sweat: 'Night sweat'
}

export default function MyCycle({ userId, onBack }) {
  const today = localToday()
  const [profile, setProfile] = useState(null)
  const [logs, setLogs] = useState(null)
  const [month, setMonth] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }))
  const [error, setError] = useState('')
  const [picked, setPicked] = useState(null) // a tapped calendar day
  const [saving, setSaving] = useState(false)

  async function load() {
    const [p, l] = await Promise.all([
      withRetry(() => supabase.from('profiles').select('*').eq('id', userId).single()),
      withRetry(() => supabase.from('cycle_logs').select('id, log_date, kind, value, created_at')
        .order('log_date', { ascending: false }).order('created_at', { ascending: false }).limit(400))
    ])
    if (p.error || l.error) { setError((p.error || l.error).message); return }
    setProfile(p.data); setLogs(l.data)
  }
  useEffect(() => { load() }, [userId])

  const view = useMemo(() => {
    if (!profile || !logs) return null
    const starts = logs.filter(l => l.kind === 'period_start').map(l => l.log_date)
    const ends = logs.filter(l => l.kind === 'period_end').map(l => l.log_date)
    const cycle = computeCycle(profile, starts, today)
    const allStarts = [...new Set([...starts, profile.last_period_start].filter(Boolean))]
    return {
      cycle, allStarts, ends,
      actual: periodDays(allStarts, ends, profile.period_length || 5, today),
      predicted: predictedDays(cycle),
      showFertile: cycle.mode === 'cycle',
      showCalendar: !['pregnant', 'menopause'].includes(cycle.mode)
    }
  }, [profile, logs, today])

  async function remove(log) {
    if (!confirm(`Delete "${LOG_LABELS[log.kind]}${log.value ? `: ${log.value}` : ''}" on ${prettyDate(log.log_date)}?`)) return
    const { error } = await supabase.from('cycle_logs').delete().eq('id', log.id)
    if (error) { setError(error.message); return }
    // Keep her profile's "last period" in step when a period start is removed.
    if (log.kind === 'period_start' && profile.last_period_start === log.log_date) {
      const next = logs.find(l => l.kind === 'period_start' && l.id !== log.id)?.log_date ?? null
      await supabase.from('profiles').update({ last_period_start: next }).eq('id', userId)
    }
    load()
  }

  // Tapping a past day: mark a period start or end, or remove a period, in any month.
  async function editDay(action) {
    const day = picked
    const len = profile.period_length || 5
    const { remove, add } = periodEdit(action, day, view.allStarts, view.ends, len, today)
    setSaving(true); setError('')
    try {
      for (const r of remove) {
        const { error } = await supabase.from('cycle_logs').delete().eq('kind', r.kind).gte('log_date', r.from).lte('log_date', r.to)
        if (error) throw error
      }
      for (const a of add) {
        const { error } = await supabase.from('cycle_logs').insert({ user_id: userId, log_date: a.date, kind: a.kind })
        if (error) throw error
      }
      // Keep her profile's "last period" pointing at her latest start.
      const { data: latest } = await supabase.from('cycle_logs').select('log_date').eq('kind', 'period_start')
        .order('log_date', { ascending: false }).limit(1)
      const old = profile.last_period_start
      const oldGone = old && remove.some(r => r.kind === 'period_start' && old >= r.from && old <= r.to)
      const candidates = [latest?.[0]?.log_date, oldGone ? null : old].filter(Boolean).sort()
      const next = candidates.at(-1) ?? null
      if (next !== old) await supabase.from('profiles').update({ last_period_start: next }).eq('id', userId)
      setPicked(null)
      await load()
    } catch (e) {
      setError(e.message || 'Could not save that. Try again?')
    } finally {
      setSaving(false)
    }
  }

  const shift = n => setMonth(({ y, m }) => {
    const t = m + n
    return { y: y + Math.floor(t / 12), m: ((t % 12) + 12) % 12 }
  })

  return (
    <div className="app">
      <header className="topbar">
        {onBack ? <button className="link" onClick={onBack} aria-label="Back to chat">← Chat</button> : <span style={{ width: 64 }} />}
        <span className="topbar-title">{profile?.life_stage === 'pregnant' ? 'My pregnancy' : profile?.life_stage === 'postmenopause' ? 'My health' : 'My cycle'}</span>
        <span style={{ width: 64 }} />
      </header>

      <main className="cycle-page">
        {error && <p className="error" role="alert">{error}</p>}
        {!view && !error && <div className="bubble hera typing"><span /><span /><span /></div>}
        {view && (
          <>
            {view.cycle.mode === 'pregnant'
              ? <><PregnancyCard cycle={view.cycle} /><WarningSigns /></>
              : <Summary cycle={view.cycle} today={today} />}
            {profile.life_stage === 'ttc' && <TtcCard profile={profile} cycle={view.cycle} today={today} />}
            {['perimenopause', 'postmenopause'].includes(profile.life_stage) && <SymptomsCard logs={logs} today={today} />}

            {view.showCalendar && <section className="card calendar" aria-label="Calendar">
              <div className="cal-head">
                <button className="link" onClick={() => shift(-1)} aria-label="Previous month">‹</button>
                <strong>{MONTHS[month.m]} {month.y}</strong>
                <button className="link" onClick={() => shift(1)} aria-label="Next month">›</button>
              </div>
              <div className="cal-grid" role="grid">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
                {monthGrid(month.y, month.m).flat().map((d, i) => {
                  if (!d) return <div key={i} />
                  const isPeriod = view.actual.has(d)
                  const isPredicted = !isPeriod && view.predicted.period.has(d)
                  const isFertile = view.showFertile && view.predicted.fertile.has(d)
                  const isOv = view.showFertile && view.predicted.ovulation === d
                  const cls = ['cal-day', isPeriod && 'period', isPredicted && 'predicted',
                    isFertile && !isPeriod && 'fertile', d === today && 'today'].filter(Boolean).join(' ')
                  const label = [prettyDate(d), isPeriod && 'period', isPredicted && 'predicted period',
                    isFertile && 'fertile window', isOv && 'estimated ovulation', d === today && 'today'].filter(Boolean).join(', ')
                  if (d > today) {
                    return (
                      <div key={i} className={cls} role="gridcell" aria-label={label}>
                        {Number(d.slice(8))}
                        {isOv && <span className="ov-dot" />}
                      </div>
                    )
                  }
                  return (
                    <button key={i} type="button" className={`${cls} tappable${picked === d ? ' picked' : ''}`} role="gridcell"
                            aria-label={`${label}. Tap to edit`} onClick={() => setPicked(picked === d ? null : d)}>
                      {Number(d.slice(8))}
                      {isOv && <span className="ov-dot" />}
                    </button>
                  )
                })}
              </div>
              <div className="legend">
                <span><i className="sw period" /> Period</span>
                <span><i className="sw predicted" /> Predicted</span>
                {view.showFertile && <span><i className="sw fertile" /> Fertile window (estimate)</span>}
              </div>
              {picked
                ? <DaySheet day={picked} saving={saving} onPick={editDay} onClose={() => setPicked(null)}
                            actions={dayActions(picked, view.allStarts, view.ends, profile.period_length || 5, today)} />
                : <p className="fine cal-hint">Tap any past day to mark when a period started or ended. Use ‹ to go back as many months as you like.</p>}
            </section>}

            {['perimenopause', 'postmenopause'].includes(profile.life_stage) && <BonesCard diet={profile.diet} />}
            <PatternsCard logs={logs} today={today} showCycle={view.cycle.mode === 'cycle' || view.cycle.mode === 'unknown'} />
            {view.cycle.mode === 'cycle' && <SexDriveCard profile={profile} logs={logs} onLogged={load} />}
            {profile.podcast_picks !== false && <PodcastCard profile={profile} cycle={view.cycle} today={today} />}
            <ReadMore stage={profile.life_stage} />

            <LogHistory logs={logs} onRemove={remove} />
          </>
        )}
      </main>
    </div>
  )
}

// Everything she's logged, newest first. Folded to the latest few so the page stays short;
// expanded, it's grouped by month.
function LogHistory({ logs, onRemove }) {
  const [open, setOpen] = useState(false)
  const PREVIEW = 3
  const shown = open ? logs : logs.slice(0, PREVIEW)
  const groups = []
  for (const l of shown) {
    const key = `${MONTHS[Number(l.log_date.slice(5, 7)) - 1]} ${l.log_date.slice(0, 4)}`
    if (groups.at(-1)?.key !== key) groups.push({ key, items: [] })
    groups.at(-1).items.push(l)
  }
  return (
    <section className="card">
      <div className="log-head">
        <h2>What you've told me</h2>
        {logs.length > 0 && (logs.length > PREVIEW
          ? <button type="button" className="log-count" aria-expanded={open} onClick={() => setOpen(o => !o)}>
              {logs.length} entries {open ? '▴' : '▾'}
            </button>
          : <span className="log-count">{logs.length} {logs.length === 1 ? 'entry' : 'entries'}</span>)}
      </div>
      {logs.length === 0 && <p className="muted">Nothing yet. Tell Hera things like "got my period today" or "cramps are a 6".</p>}
      {groups.map(g => (
        <div key={g.key}>
          {open && <p className="log-month">{g.key}</p>}
          <ul className="log-list">
            {g.items.map(l => (
              <li key={l.id}>
                <span className="log-date">{prettyDate(l.log_date)}</span>
                <span className="log-text">{LOG_LABELS[l.kind]}{l.value ? `: ${l.value}` : ''}</span>
                <button className="del" onClick={() => onRemove(l)} aria-label={`Delete ${LOG_LABELS[l.kind]} on ${prettyDate(l.log_date)}`}>×</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {logs.length > PREVIEW && (
        <button type="button" className="link left" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {open ? 'Show less' : `Show all ${logs.length} entries`}
        </button>
      )}
    </section>
  )
}

const ACTION_LABELS = {
  start: '🩸 My period started this day',
  end: 'My period ended this day',
  remove: 'No period here: remove it'
}

function DaySheet({ day, actions, saving, onPick, onClose }) {
  return (
    <div className="day-sheet" role="dialog" aria-label={`Edit ${prettyDate(day)}`}>
      <strong>{prettyDate(day)}</strong>
      <div className="day-actions">
        {actions.map(a => (
          <button key={a} type="button" className={a === 'remove' ? 'chip quiet' : 'chip'} disabled={saving} onClick={() => onPick(a)}>
            {ACTION_LABELS[a]}
          </button>
        ))}
        <button type="button" className="link" disabled={saving} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

function Summary({ cycle, today }) {
  const message = {
    menopause: "You're postmenopausal, so there's no cycle to predict. Any bleeding now is worth checking with a doctor.",
    no_phases: `You're on ${cycle.reason}, so there are no natural phases to predict. I'll track bleeding and symptoms.`,
    unknown: 'Tell Hera when your last period started, or tap the day on the calendar below, and your calendar will fill in.'
  }[cycle.mode]
  if (message) return <section className="card"><p className="muted">{message}</p></section>

  if (cycle.phase === 'late') {
    return (
      <section className="card summary">
        <div><span className="k">Today</span><span className="v">Period {cycle.lateBy} days later than expected</span></div>
        <div><span className="k">Typical cycle</span><span className="v">{cycle.cycleLength} days</span></div>
        <p className="fine">Tell Hera when it starts. If you're often late or it's been over 3 months, it's worth seeing a doctor.</p>
      </section>
    )
  }

  const tip = cycle.lateLuteal ? PHASE_TIPS.lateLuteal : PHASE_TIPS[cycle.phase]
  const until = daysBetween(today, cycle.nextPeriod.from)
  return (
    <section className="card summary">
      <div className="hero">
        <Ring day={cycle.day} length={cycle.cycleLength} phase={cycle.phase} />
        <div>
          <div className={`phase-name ${cycle.phase}`}>{PHASE_LABELS[cycle.phase]}</div>
          <p className="tip">{tip}</p>
        </div>
      </div>
      <dl className="facts">
        <div>
          <dt><i className="sw period" /> Next period</dt>
          <dd>
            {shortRange(cycle.nextPeriod.from, cycle.nextPeriod.to)}
            <small>{until > 1 ? `in ${until} days` : until === 1 ? 'from tomorrow' : 'any day now'}</small>
          </dd>
        </div>
        <div>
          <dt><i className="sw fertile" /> Fertile window</dt>
          <dd>{shortRange(cycle.fertileWindow.from, cycle.fertileWindow.to)}</dd>
        </div>
      </dl>
      <p className="fine">
        {cycle.cycleLength}-day cycle, based on {cycle.basedOn}.{cycle.rough ? ' Your dates are rough, so treat them as a guide.' : ''} Estimates only, never contraception.
      </p>
    </section>
  )
}

const PHASE_TIPS = {
  menstrual: 'Rest, stay warm, and eat iron-rich food.',
  follicular: 'Energy is rising. A good time to start new things.',
  ovulatory: 'Peak energy and confidence. Enjoy it!',
  luteal: 'Energy slows down. Keep meals regular.',
  lateLuteal: 'PMS days. Be extra gentle with yourself.'
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// '20–26 Oct', or '30 Sep – 4 Oct' across months
function shortRange(from, to) {
  const f = [Number(from.slice(8)), MON[Number(from.slice(5, 7)) - 1]]
  const t = [Number(to.slice(8)), MON[Number(to.slice(5, 7)) - 1]]
  return f[1] === t[1] ? `${f[0]}–${t[0]} ${t[1]}` : `${f[0]} ${f[1]} – ${t[0]} ${t[1]}`
}

function Ring({ day, length, phase }) {
  const r = 34, c = 2 * Math.PI * r
  const done = Math.min(day / length, 1)
  return (
    <svg className="ring" width="88" height="88" viewBox="0 0 88 88" role="img" aria-label={`Day ${day} of ${length}`}>
      <circle cx="44" cy="44" r={r} className="ring-track" />
      <circle cx="44" cy="44" r={r} className={`ring-fill ${phase}`} strokeDasharray={`${c * done} ${c}`}
              transform="rotate(-90 44 44)" />
      <text x="44" y="42" textAnchor="middle" className="ring-day">Day {day}</text>
      <text x="44" y="58" textAnchor="middle" className="ring-of">of {length}</text>
    </svg>
  )
}

