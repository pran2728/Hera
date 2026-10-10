// Cards on the My cycle screen for each life stage. Content comes from src/lib/stages.js.
import { useState } from 'react'
import { prettyDate } from '../lib/cycle'
import { localToday } from '../lib/dates'
import { quickLog } from '../lib/quicklog'
import { pregnancyGuide, WARNING_SIGNS, ttcInfo, symptomSummary, boneFoods, sexDrivePattern, SOURCES, STAGE_SOURCES } from '../lib/stages'

export function PregnancyCard({ cycle }) {
  const w = cycle.pregnancy
  if (!w) {
    return (
      <section className="card">
        <h2>Pregnancy mode 💜</h2>
        <p className="muted small">Add your due date in My profile (or just tell Hera) and I'll follow along week by week.</p>
      </section>
    )
  }
  const g = pregnancyGuide(w)
  const pct = Math.min(100, Math.round(((280 - w.toGo) / 280) * 100))
  return (
    <section className="card summary preg">
      <div className="preg-head">
        <div>
          <div className="phase-name preg-week">Week {w.week}{w.day ? ` · day ${w.day}` : ''}</div>
          <p className="tip">Trimester {w.trimester} · baby is about the size of {g.size}</p>
        </div>
      </div>
      <div className="bar" role="img" aria-label={`${pct}% of the way to your due date`}><span style={{ width: `${pct}%` }} /></div>
      <dl className="facts">
        <div><dt>Due date</dt><dd>{prettyDate(w.due)}<small>{w.toGo > 0 ? `${w.toGo} days to go` : w.toGo === 0 ? 'today!' : `${-w.toGo} days past`}{w.estimated ? ' · estimated' : ''}</small></dd></div>
      </dl>
      <div>
        <h3 className="mini">{g.title}</h3>
        <p className="tip">{g.focus}</p>
      </div>
      {w.estimated && <p className="fine">Estimated from your last period. Add the due date your doctor gave you in My profile.</p>}
    </section>
  )
}

export function WarningSigns() {
  return (
    <section className="card warn">
      <h2>Call your doctor or go to hospital now if you have</h2>
      <ul className="warn-list">{WARNING_SIGNS.map(s => <li key={s}>{s}</li>)}</ul>
      <a className="safety-btn urgent" href="tel:112">Emergency: call 112</a>
    </section>
  )
}

export function TtcCard({ profile, cycle, today }) {
  const t = ttcInfo(profile, cycle, today)
  return (
    <section className="card">
      <h2>Trying to conceive</h2>
      <dl className="facts">
        <div><dt>Trying for</dt><dd>{t.months === null ? 'Not set' : t.months < 1 ? 'Under a month' : `About ${t.months} month${t.months === 1 ? '' : 's'}`}</dd></div>
      </dl>
      <p className="tip">💊 Keep taking folic acid every day: ask your doctor for the right dose.</p>
      <p className="tip">
        {t.seeDoctor
          ? `🩺 It's been ${t.limit}+ months, so this is a good time to see a fertility specialist. Both partners can get checked.`
          : t.earlyCheck
            ? '🩺 With PCOS or irregular cycles, an early check-up with a gynaecologist helps. No need to wait a year.'
            : `🩺 Most couples conceive within a year. If it hasn't happened after ${t.limit} months, see a fertility specialist.`}
      </p>
      <p className="fine">Fertile windows are estimates. Sex every 2–3 days through your cycle works just as well as timing it.</p>
    </section>
  )
}

export function SymptomsCard({ logs, today }) {
  const s = symptomSummary(logs, today)
  const rows = [['🔥 Hot flushes', s.hot_flash], ['💦 Night sweats', s.night_sweat], ['😴 Poor sleep', s.poor_sleep], ['🌧️ Low mood', s.low_mood]]
  const empty = rows.every(r => !r[1]) && !s.top.length
  return (
    <section className="card">
      <h2>Your last 30 days</h2>
      {empty
        ? <p className="muted small">Nothing logged yet. Tell Hera things like "had 3 hot flushes today" or "slept badly", and they'll add up here.</p>
        : <>
            <dl className="facts">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v ? `${v} day${v === 1 ? '' : 's'}` : '—'}</dd></div>)}</dl>
            {s.top.length > 0 && <p className="tip">Also logged: {s.top.join(', ')}</p>}
          </>}
      <p className="fine">Bring this to your doctor: it makes conversations about treatment much easier.</p>
    </section>
  )
}

export function BonesCard({ diet }) {
  return (
    <section className="card">
      <h2>Food for strong bones</h2>
      <p className="muted small">Bones thin faster after menopause. Calcium, vitamin D and protein help, plus strength exercise twice a week.</p>
      <div className="food-chips">{boneFoods(diet).map(f => <span key={f} className="food">{f}</span>)}</div>
      <p className="fine">15–20 minutes of morning sun helps your body make vitamin D. Ask your doctor before taking supplements.</p>
    </section>
  )
}

export function SexDriveCard({ profile, logs, onLogged }) {
  const p = sexDrivePattern(profile, logs)
  const n = logs.filter(l => l.kind === 'sex_drive').length
  const today = localToday()
  const todays = logs.find(l => l.kind === 'sex_drive' && l.log_date === today)
  const [note, setNote] = useState('')
  async function log(value) {
    setNote('')
    try { await quickLog(profile.id, profile, 'sex_drive', value, today); setNote(`Logged: ${value} today 💜`); onLogged?.() }
    catch { setNote("Couldn't save that. Try again?") }
  }
  return (
    <section className="card">
      <h2>Your sex drive</h2>
      {p
        ? <p className="tip">{p.text} It's normal for desire to move with your hormones.</p>
        : <p className="muted small">
            {n ? `${n} of 4 check-ins so far. ` : ''}Tap below now and then (or tell Hera in chat), and she'll show how it moves with your cycle.
          </p>}
      <div className="quick" role="group" aria-label="Your sex drive today">
        {[['Low', 'low'], ['Normal', 'normal'], ['High', 'high']].map(([label, v]) => (
          <button key={v} type="button" className={`chip quick-chip ${todays?.value === v ? 'on' : ''}`} onClick={() => log(v)}>{label}</button>
        ))}
      </div>
      {note && <p className="notice" role="status">{note}</p>}
    </section>
  )
}

export function ReadMore({ stage }) {
  const keys = STAGE_SOURCES[stage]
  if (!keys) return null
  return (
    <section className="card">
      <h2>Trusted reading</h2>
      <ul className="links">
        {keys.map(k => <li key={k}><a href={SOURCES[k].url} target="_blank" rel="noreferrer">{SOURCES[k].title} ↗</a></li>)}
      </ul>
    </section>
  )
}
