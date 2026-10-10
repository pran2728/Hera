// Turns logs + the cycle prediction into what each calendar day shows.
import { addDays, daysBetween, toDays } from './cycle.js'

// Actual period days from logged starts and ends (an end within 15 days closes that period).
export function periodDays(starts, ends, periodLength, today) {
  const days = new Set()
  const sortedEnds = [...ends].sort()
  for (const start of starts) {
    const end = sortedEnds.find(e => e >= start && daysBetween(start, e) <= 15)
    let last = end ?? addDays(start, periodLength - 1)
    if (!end && last > today) last = today // ongoing period: only up to today
    for (let d = start; d <= last; d = addDays(d, 1)) days.add(d)
  }
  return days
}

export function predictedDays(cycle) {
  const out = { period: new Set(), fertile: new Set(), ovulation: null }
  if (cycle?.mode !== 'cycle' || cycle.phase === 'late') return out
  for (let i = 0; i < cycle.periodLength; i++) out.period.add(addDays(cycle.nextPeriod.expected, i))
  for (let d = cycle.fertileWindow.from; d <= cycle.fertileWindow.to; d = addDays(d, 1)) out.fertile.add(d)
  out.ovulation = cycle.ovulation
  return out
}

// Weeks (Monday first) covering a month: arrays of 'YYYY-MM-DD' or null for padding.
export function monthGrid(year, month) {
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const weekday = (new Date(toDays(first) * 86400000).getUTCDay() + 6) % 7 // Mon = 0
  const cells = Array(weekday).fill(null)
  for (let i = 0; i < lastDay; i++) cells.push(addDays(first, i))
  while (cells.length % 7) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

// ---------- Editing past periods from the calendar ----------
// Which period (if any) a day belongs to: { start, end } where end is the logged end or the estimated last day.
export function periodFor(day, starts, ends, periodLength, today) {
  const sortedEnds = [...ends].sort()
  for (const start of [...starts].sort().reverse()) {
    if (start > day) continue
    const end = sortedEnds.find(e => e >= start && daysBetween(start, e) <= 15)
    let last = end ?? addDays(start, periodLength - 1)
    if (!end && last > today) last = today
    return day <= last ? { start, end: end ?? null, last } : null
  }
  return null
}

// What she can do when she taps a day: 'start', 'end', 'remove'. Future days can't be edited.
export function dayActions(day, starts, ends, periodLength, today) {
  if (!day || day > today) return []
  const p = periodFor(day, starts, ends, periodLength, today)
  if (p) {
    const out = []
    if (p.start !== day) out.push('start')
    if (p.end !== day) out.push('end')
    out.push('remove')
    return out
  }
  const out = ['start']
  // Just after a period: she can say it ended later than we thought.
  const before = [...starts].sort().reverse().find(s => s < day)
  if (before && daysBetween(before, day) <= 14) out.push('end')
  return out
}

// The database changes for a tapped action: rows to delete (by kind and date range) and rows to add.
export function periodEdit(action, day, starts, ends, periodLength, today) {
  const p = periodFor(day, starts, ends, periodLength, today)
  if (action === 'start') {
    // One start per period: replace any start within 10 days.
    return { remove: [{ kind: 'period_start', from: addDays(day, -10), to: addDays(day, 10) }], add: [{ kind: 'period_start', date: day }] }
  }
  if (action === 'end') {
    const start = p?.start ?? [...starts].sort().reverse().find(s => s < day)
    return { remove: [{ kind: 'period_end', from: start, to: addDays(start, 15) }], add: [{ kind: 'period_end', date: day }] }
  }
  if (action === 'remove' && p) {
    return { remove: [{ kind: 'period_start', from: p.start, to: p.start }, { kind: 'period_end', from: p.start, to: addDays(p.start, 15) }], add: [] }
  }
  return { remove: [], add: [] }
}
