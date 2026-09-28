// Hera's cycle engine. Pure date maths, no network.
// Used by the app, and copied into the hera-chat function by scripts/build-function.mjs.
// Dates are 'YYYY-MM-DD' strings in the woman's local calendar.

export const DAY_MS = 86400000

export function toDays(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY_MS
}

export function fromDays(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10)
}

export function addDays(iso, n) {
  return fromDays(toDays(iso) + n)
}

export function daysBetween(a, b) {
  return toDays(b) - toDays(a)
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// 'Mon 28 Sep'
export function prettyDate(iso) {
  const n = toDays(iso)
  const d = new Date(n * DAY_MS)
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
}

// Contraception that switches off natural phases (no ovulation, or bleeding is not a true period).
const NO_PHASE_CONTRACEPTION = {
  combined: 'the combined pill, patch or ring',
  progestin_pill: 'the mini-pill',
  hormonal_iud: 'a hormonal IUD',
  implant: 'an implant or injection'
}

export const PHASE_LABELS = {
  menstrual: 'Menstrual phase',
  follicular: 'Follicular phase',
  ovulatory: 'Ovulatory phase',
  luteal: 'Luteal phase'
}

/**
 * @param profile  row from public.profiles
 * @param starts   period start dates ('YYYY-MM-DD'), any order
 * @param today    'YYYY-MM-DD'
 */
export function computeCycle(profile = {}, starts = [], today) {
  const stage = profile.life_stage || 'cycles'
  const conditions = profile.conditions || []

  if (stage === 'pregnant') return { mode: 'pregnant' }
  if (stage === 'postmenopause') return { mode: 'menopause' }
  if (NO_PHASE_CONTRACEPTION[profile.contraception]) {
    return { mode: 'no_phases', reason: NO_PHASE_CONTRACEPTION[profile.contraception] }
  }

  const all = [...new Set([...starts, profile.last_period_start].filter(Boolean))]
    .filter(d => toDays(d) <= toDays(today))
    .sort()
  if (all.length === 0) return { mode: 'unknown' }

  const lastStart = all[all.length - 1]

  // Cycle lengths from her own history (ignore gaps that can't be one cycle).
  const gaps = []
  for (let i = 1; i < all.length; i++) {
    const g = daysBetween(all[i - 1], all[i])
    if (g >= 15 && g <= 90) gaps.push(g)
  }
  const recent = gaps.slice(-6)
  const fromHistory = recent.length >= 2
  const cycleLength = fromHistory
    ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
    : (profile.cycle_length || 28)
  const periodLength = profile.period_length || 5

  const irregular = recent.length >= 2 && Math.max(...recent) - Math.min(...recent) > 7
  const pcos = conditions.some(c => /pcos|pcod/i.test(c))
  const rough = irregular || pcos || stage === 'perimenopause' ||
    (!fromHistory && !profile.cycle_length_known)
  const spread = rough ? 5 : fromHistory ? 2 : 3

  const day = daysBetween(lastStart, today) + 1
  const ovDay = Math.max(cycleLength - 14, periodLength + 1)
  const expected = addDays(lastStart, cycleLength)
  const ovulation = addDays(lastStart, ovDay - 1)

  const result = {
    mode: 'cycle',
    lastStart,
    day,
    cycleLength,
    periodLength,
    rough,
    irregular,
    pcos,
    basedOn: fromHistory ? `${recent.length + 1} logged periods` : 'what you told me at signup',
    nextPeriod: { from: addDays(expected, -spread), to: addDays(expected, spread), expected },
    ovulation,
    fertileWindow: { from: addDays(ovulation, -5), to: ovulation },
    phase: null,
    lateLuteal: false,
    lateBy: 0
  }

  if (day > cycleLength + spread) {
    result.phase = 'late'
    result.lateBy = day - cycleLength
    return result
  }

  if (day <= periodLength) result.phase = 'menstrual'
  else if (day < ovDay - 1) result.phase = 'follicular'
  else if (day <= ovDay + 1) result.phase = 'ovulatory'
  else result.phase = 'luteal'

  result.lateLuteal = result.phase === 'luteal' && day > cycleLength - 7
  return result
}

// One plain-English paragraph for Hera's prompt and for debugging.
export function describeCycle(c) {
  switch (c.mode) {
    case 'pregnant':
      return 'She is pregnant. Do not predict periods or phases.'
    case 'menopause':
      return 'She is postmenopausal. No cycle predictions. Any vaginal bleeding now is a red flag for a doctor visit.'
    case 'no_phases':
      return `She uses ${c.reason}, so she has no natural cycle phases. Do not predict phases, ovulation or a fertile window. Track bleeding and symptoms only.`
    case 'unknown':
      return 'No period date logged yet. If relevant, gently ask when her last period started.'
  }
  const parts = [
    `Last period started ${prettyDate(c.lastStart)} (cycle day ${c.day}).`,
    `Typical cycle about ${c.cycleLength} days, based on ${c.basedOn}.`
  ]
  if (c.phase === 'late') {
    parts.push(`Her period is about ${c.lateBy} days later than expected. Don't alarm her; suggest a pregnancy test if that's possible for her, and a doctor if she's often late or it's been over 3 months.`)
  } else {
    parts.push(`Current phase: ${c.phase}${c.lateLuteal ? ' (late luteal: the PMS days, mood often lowest)' : ''}.`)
    parts.push(`Next period expected between ${prettyDate(c.nextPeriod.from)} and ${prettyDate(c.nextPeriod.to)}.`)
    parts.push(`Estimated fertile window ${prettyDate(c.fertileWindow.from)} to ${prettyDate(c.fertileWindow.to)} (an estimate, never contraception).`)
  }
  if (c.rough) {
    parts.push(`Predictions are rough${c.pcos ? ' because of PCOS/PCOD' : c.irregular ? ' because her cycles vary' : ''}; say so if you give dates.`)
  }
  return parts.join(' ')
}
