// The Today screen's prediction strip and phase card (pure functions, so they're easy to test).
import { addDays, daysBetween } from './cycle.js'
import { plateFor } from './stories.js'

const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dow = iso => new Date(iso + 'T00:00:00Z').getUTCDay()
export const shortDate = iso => `${Number(iso.slice(8))} ${MON[Number(iso.slice(5, 7)) - 1]}`
export const dayDate = iso => `${WEEKDAY[dow(iso)]} ${shortDate(iso)}`
// "1–5 Dec", or "29 Nov – 3 Dec" across months
export const dateRange = (a, b) => a.slice(0, 7) === b.slice(0, 7)
  ? `${Number(a.slice(8))}–${shortDate(b)}` : `${shortDate(a)} – ${shortDate(b)}`

// Seven days around her expected period: the expected day is "most likely", the rest of the
// predicted range "likely". Only for a regular cycle that isn't late.
export function predictionStrip(cycle, today) {
  if (cycle?.mode !== 'cycle' || cycle.phase === 'late') return null
  const { expected, from, to } = cycle.nextPeriod
  // On her period: the strip is about the NEXT one, which is what nextPeriod already holds.
  const start = addDays(expected, -3)
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i)
    const level = date === expected ? 'most' : date >= from && date <= to ? 'likely' : null
    return { date, letter: DOW[dow(date)], n: Number(date.slice(8)), level, today: date === today }
  })
  const pmsFrom = addDays(cycle.lastStart, cycle.cycleLength - 7)
  return {
    days,
    inDays: daysBetween(today, expected),
    expected,
    range: dateRange(from, to),
    basedOn: cycle.basedOn,
    // Only worth saying while PMS days are still ahead.
    pmsFrom: pmsFrom > today && cycle.phase !== 'menstrual' ? pmsFrom : null
  }
}

// Where she is in her cycle as four segments and a marker, plus what the phase means and what helps.
export function phaseCard(cycle, profile = {}) {
  if (cycle?.mode !== 'cycle') return null
  const { day, cycleLength: n, periodLength: p } = cycle
  if (cycle.phase === 'late') {
    return {
      name: 'Running late', kicker: `DAY ${day}`,
      explain: 'Stress, travel, illness and big changes can all shift a cycle. If it is more than a week late and you could be pregnant, a home test is the quickest answer.',
      bar: null, tips: []
    }
  }
  const ovDay = Math.max(n - 14, p + 1)
  const seg = [p, Math.max(ovDay - 2 - p, 1), 3, Math.max(n - (ovDay + 1), 1)]
  const total = seg.reduce((a, b) => a + b, 0)
  const marker = Math.min(Math.max((day - 0.5) / total, 0.02), 0.98)

  const key = cycle.lateLuteal ? 'pms' : cycle.phase
  const g = GUIDE[key]
  const foods = plateFor(profile, key).foods.slice(0, 3)
  const eat = foods.length ? `Eat: ${foods.join(', ').toLowerCase()}` : null
  return {
    name: g.name, kicker: `YOUR PHASE · DAY ${day}`, explain: g.explain,
    bar: { seg, marker, labels: ['Period', 'Follicular', 'Ovulation', 'Luteal'] },
    tips: [eat, `Move: ${g.move}`, `Feel: ${g.feel}`].filter(Boolean)
  }
}

const GUIDE = {
  menstrual: { name: 'Period: rest and restore',
    explain: 'Hormones are at their lowest, so energy dips and cramps are common. Rest counts as productive this week.',
    move: 'gentle stretches or a slow walk', feel: 'say no to extras; a hot water bag helps' },
  follicular: { name: 'Follicular: energy rising',
    explain: 'Estrogen climbs after your period, so mood and energy lift. A good week to start new things.',
    move: 'try a harder workout or a new class', feel: 'plan the things that need focus' },
  ovulatory: { name: 'Ovulation: your peak',
    explain: 'Estrogen peaks, so you may feel your most social and confident. This is also your fertile window.',
    move: 'your strongest days, so go for it', feel: 'a good time for big conversations' },
  luteal: { name: 'Luteal: slow and steady',
    explain: 'Progesterone is rising, so energy dips and cravings grow. Go a little easier on yourself.',
    move: 'a walk, pilates or gentle yoga', feel: 'plan lighter evenings' },
  pms: { name: 'PMS days: be gentle',
    explain: 'Hormones drop before your period, which can bring bloating, low mood and irritability. It passes.',
    move: 'a short walk or yoga eases cramps and mood', feel: "it's okay to cancel plans" }
}
