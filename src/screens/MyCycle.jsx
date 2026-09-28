import { useEffect, useMemo, useState } from 'react'
import { supabase, withRetry } from '../lib/supabase'
import { localToday } from '../lib/dates'
import { computeCycle, prettyDate, PHASE_LABELS } from '../lib/cycle'
import { periodDays, predictedDays, monthGrid } from '../lib/calendar'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const LOG_LABELS = {
  period_start: 'Period started', period_end: 'Period ended', flow: 'Flow', pain: 'Pain',
  mood: 'Mood', energy: 'Energy', symptom: 'Symptom', sleep: 'Sleep', sex_drive: 'Sex drive', note: 'Note'
}

export default function MyCycle({ userId, onBack }) {
  const today = localToday()
  const [profile, setProfile] = useState(null)
  const [logs, setLogs] = useState(null)
  const [month, setMonth] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }))
  const [error, setError] = useState('')

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
      cycle,
      actual: periodDays(allStarts, ends, profile.period_length || 5, today),
      predicted: predictedDays(cycle),
      showFertile: cycle.mode === 'cycle'
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

  const shift = n => setMonth(({ y, m }) => {
    const t = m + n
    return { y: y + Math.floor(t / 12), m: ((t % 12) + 12) % 12 }
  })

  return (
    <div className="app">
      <header className="topbar">
        <button className="link" onClick={onBack} aria-label="Back to chat">← Chat</button>
        <span className="topbar-title">My cycle</span>
        <span style={{ width: 64 }} />
      </header>

      <main className="cycle-page">
        {error && <p className="error" role="alert">{error}</p>}
        {!view && !error && <div className="bubble hera typing"><span /><span /><span /></div>}
        {view && (
          <>
            <Summary cycle={view.cycle} />

            <section className="card calendar" aria-label="Calendar">
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
                  return (
                    <div key={i} className={cls} role="gridcell" aria-label={label}>
                      {Number(d.slice(8))}
                      {isOv && <span className="ov-dot" />}
                    </div>
                  )
                })}
              </div>
              <div className="legend">
                <span><i className="sw period" /> Period</span>
                <span><i className="sw predicted" /> Predicted</span>
                {view.showFertile && <span><i className="sw fertile" /> Fertile window (estimate)</span>}
              </div>
            </section>

            <section className="card">
              <h2>What you've told me</h2>
              {logs.length === 0 && <p className="muted">Nothing yet. Tell Hera things like "got my period today" or "cramps are a 6".</p>}
              <ul className="log-list">
                {logs.map(l => (
                  <li key={l.id}>
                    <span className="log-date">{prettyDate(l.log_date)}</span>
                    <span className="log-text">{LOG_LABELS[l.kind]}{l.value ? `: ${l.value}` : ''}</span>
                    <button className="del" onClick={() => remove(l)} aria-label={`Delete ${LOG_LABELS[l.kind]} on ${prettyDate(l.log_date)}`}>×</button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

function Summary({ cycle }) {
  const message = {
    pregnant: "You're in pregnancy mode, so I'm not predicting periods. Tell me how you're feeling anytime.",
    menopause: "You're postmenopausal, so there's no cycle to predict. Any bleeding now is worth checking with a doctor.",
    no_phases: `You're on ${cycle.reason}, so there are no natural phases to predict. I'll track bleeding and symptoms.`,
    unknown: 'Tell Hera when your last period started and your calendar will fill in.'
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

  return (
    <section className="card summary">
      <div>
        <span className="k">Today</span>
        <span className="v">
          {cycle.phase === 'late' ? `Period ${cycle.lateBy} days late` : `Day ${cycle.day} · ${PHASE_LABELS[cycle.phase]}`}
        </span>
      </div>
      <div>
        <span className="k">Next period</span>
        <span className="v">{prettyDate(cycle.nextPeriod.from)} – {prettyDate(cycle.nextPeriod.to)}</span>
      </div>
      <div>
        <span className="k">Fertile window</span>
        <span className="v">{prettyDate(cycle.fertileWindow.from)} – {prettyDate(cycle.fertileWindow.to)}</span>
      </div>
      <div>
        <span className="k">Typical cycle</span>
        <span className="v">{cycle.cycleLength} days</span>
      </div>
      <p className="fine">
        Based on {cycle.basedOn}.{cycle.rough ? ' Predictions are rough for you, so treat dates as a guide.' : ''} Fertile
        windows are estimates and never a form of contraception.
      </p>
    </section>
  )
}
