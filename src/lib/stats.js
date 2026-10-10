// Her numbers: cycle and period length trends, pain over cycles, and symptom statistics.
// Pure logic, used by My cycle and Hera's prompt.
import { daysBetween, addDays } from './cycle.js'

const avg = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
const round1 = x => x === null ? null : Math.round(x * 10) / 10

// Completed cycles from her period starts: [{start, length}], oldest first.
export function cycleHistory(starts) {
  const s = [...new Set(starts)].sort()
  const out = []
  for (let i = 1; i < s.length; i++) {
    const len = daysBetween(s[i - 1], s[i])
    if (len >= 15 && len <= 90) out.push({ start: s[i - 1], length: len })
  }
  return out
}

// How long each period lasted, when she logged an end within 15 days of a start.
export function periodLengths(starts, ends) {
  const out = []
  for (const st of [...new Set(starts)].sort()) {
    const end = [...ends].sort().find(e => e >= st && daysBetween(st, e) <= 15)
    if (end) out.push({ start: st, length: daysBetween(st, end) + 1 })
  }
  return out
}

/**
 * Is a series going up, down or holding steady?
 * Compares the average of the latest 3 with the 3 before. Needs 4+ values.
 * @param threshold  change that counts as real (days, points…)
 */
export function trend(values, threshold = 2) {
  if (values.length < 4) return null
  const recent = values.slice(-3), before = values.slice(-6, -3)
  const diff = avg(recent) - avg(before)
  return { direction: Math.abs(diff) < threshold ? 'steady' : diff > 0 ? 'up' : 'down', diff: round1(diff) }
}

const painScore = v => {
  const m = /(\d+(?:\.\d+)?)/.exec(String(v ?? ''))
  return m && Number(m[1]) <= 10 ? Number(m[1]) : null
}

// Average pain during each cycle (only cycles where she logged pain).
export function painByCycle(starts, logs) {
  const s = [...new Set(starts)].sort()
  const pain = logs.filter(l => l.kind === 'pain').map(l => ({ d: l.log_date, v: painScore(l.value) })).filter(p => p.v !== null)
  const out = []
  s.forEach((st, i) => {
    const next = s[i + 1] ?? '9999-12-31'
    const inCycle = pain.filter(p => p.d >= st && p.d < next)
    if (inCycle.length) out.push({ start: st, avg: round1(avg(inCycle.map(p => p.v))) })
  })
  return out
}

export function cycleTrends(starts, ends, logs) {
  const cycles = cycleHistory(starts).slice(-12)
  const lengths = cycles.map(c => c.length)
  const periods = periodLengths(starts, ends).slice(-12)
  const pain = painByCycle(starts, logs).slice(-12)
  return {
    cycles,
    cycleAvg: round1(avg(lengths)),
    cycleRange: lengths.length ? [Math.min(...lengths), Math.max(...lengths)] : null,
    regular: lengths.length >= 3 ? Math.max(...lengths) - Math.min(...lengths) <= 7 : null,
    cycleTrend: trend(lengths, 2),
    periodAvg: round1(avg(periods.map(p => p.length))),
    periodTrend: trend(periods.map(p => p.length), 1),
    pain,
    painAvg: round1(avg(pain.map(p => p.avg))),
    painTrend: trend(pain.map(p => p.avg), 1)
  }
}

// What she logged in the last N days (90 by default).
export function symptomStats(logs, today, days = 90) {
  const from = addDays(today, -(days - 1))
  const recent = logs.filter(l => l.log_date >= from && l.log_date <= today)
  const tally = kind => {
    const t = {}
    for (const l of recent.filter(l => l.kind === kind && l.value)) {
      const k = String(l.value).toLowerCase().trim()
      t[k] = (t[k] ?? 0) + 1
    }
    return Object.entries(t).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))
  }
  const pains = recent.filter(l => l.kind === 'pain').map(l => painScore(l.value)).filter(v => v !== null)
  return {
    days,
    daysLogged: new Set(recent.map(l => l.log_date)).size,
    symptoms: tally('symptom').slice(0, 5),
    moods: tally('mood').slice(0, 3),
    energy: tally('energy'),
    painDays: new Set(recent.filter(l => l.kind === 'pain').map(l => l.log_date)).size,
    painAvg: round1(avg(pains)),
    painMax: pains.length ? Math.max(...pains) : null
  }
}

const WORD = { up: 'getting longer', down: 'getting shorter', steady: 'steady' }

// One line for Hera's prompt.
export function describeTrends(t, s) {
  const parts = []
  if (t.cycleAvg) parts.push(`average cycle ${t.cycleAvg} days (range ${t.cycleRange[0]}-${t.cycleRange[1]})${t.cycleTrend ? `, ${WORD[t.cycleTrend.direction]}` : ''}`)
  if (t.periodAvg) parts.push(`periods last about ${t.periodAvg} days`)
  if (t.painAvg !== null) parts.push(`period-cycle pain averages ${t.painAvg}/10${t.painTrend ? (t.painTrend.direction === 'steady' ? ', steady' : t.painTrend.direction === 'up' ? ', getting worse' : ', easing') : ''}`)
  if (s.symptoms.length) parts.push(`most logged symptoms (90 days): ${s.symptoms.slice(0, 3).map(x => x.name).join(', ')}`)
  if (s.moods.length) parts.push(`most common mood: ${s.moods[0].name}`)
  return parts.length ? `Her patterns: ${parts.join('; ')}.` : ''
}
