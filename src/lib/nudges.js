// Hera's proactive messages: which one is due right now, and what it says.
// Pure logic, used by the hera-nudge function (copied in by scripts/build-function.mjs) and by tests.
import { computeCycle, daysBetween } from './cycle.js'

export const DAILY_CAP = 3
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Her local date, time and weekday in her own timezone.
export function localClock(now, timeZone) {
  let parts
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23'
    }).formatToParts(now)
  } catch {
    return localClock(now, 'Asia/Kolkata')
  }
  const get = t => parts.find(p => p.type === t)?.value
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')), weekday: wd }
}

export function toMinutes(hhmm, fallback) {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback
}

export function inQuietHours(minutes, start, end) {
  if (start === end) return false
  return start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end
}

/**
 * Decide the one nudge to send now, or null.
 * @param p        profile row (with reminder settings)
 * @param starts   period start dates
 * @param ends     period end dates
 * @param sent     [{kind, for_date}] already sent recently
 * @param now      Date
 */
export function dueNudge(p, starts, ends, sent, now) {
  const clock = localClock(now, p.timezone || 'Asia/Kolkata')
  const today = clock.date
  if (p.paused_until && new Date(p.paused_until) > now) return null
  if (inQuietHours(clock.minutes, toMinutes(p.quiet_start, 22 * 60), toMinutes(p.quiet_end, 8 * 60))) return null
  if (clock.minutes < toMinutes(p.nudge_time, 9 * 60)) return null

  const sentToday = sent.filter(s => s.for_date === today)
  if (sentToday.length >= DAILY_CAP) return null
  const already = kind => sentToday.some(s => s.kind === kind)

  const cycle = computeCycle(p, starts, today)
  const candidates = []

  if (cycle.mode === 'cycle') {
    const toExpected = daysBetween(today, cycle.nextPeriod.expected)
    const pastExpected = -toExpected
    if (pastExpected === 0 || pastExpected === 2) candidates.push('period_check')
    if (toExpected === 2) candidates.push('period_heads_up')
    const endedSinceStart = ends.some(e => e >= cycle.lastStart)
    if (cycle.day === 4 && !endedSinceStart) candidates.push('period_end_check')
  }
  if (clock.weekday === (p.checkin_day ?? 0)) candidates.push('weekly_checkin')
  if (p.daily_tips) candidates.push('daily_tip')

  const kind = candidates.find(k => !already(k))
  if (!kind) return null
  return { kind, for_date: today, text: nudgeText(kind, p, cycle, today) }
}

// ---------- What Hera says ----------

const PHASE_WORDS = {
  menstrual: 'your period days', follicular: 'your follicular phase', ovulatory: 'your ovulation days',
  luteal: 'your luteal phase', late: 'this stretch'
}

const TIPS = {
  menstrual: [
    'Iron + vitamin C today: palak or rajma with a squeeze of lemon. And keep warm water or ginger tea close 💜',
    'Aim for 2.5–3 L of water today. Warm fluids and a hot water bag help with cramps.',
    'Gentle is the goal today: a short walk or easy stretches beat a hard workout.'
  ],
  follicular: [
    'Energy is rising! A great week to try that workout or start something new.',
    'Fresh and light works well now: sprouts, curd, idli or a millet bowl.',
    'About 2–2.5 L of water is enough this week, more if you work out.'
  ],
  ovulatory: [
    'Peak energy days: perfect for plans, presentations or a big workout.',
    'Load up on fibre and colour: cabbage, papaya, fruits, nuts and seeds.',
    'Your body runs a little warmer now. Keep about 2.5 L of water going.'
  ],
  luteal: [
    'Cravings? Go for complex carbs like ragi, oats or sweet potato to keep your mood steady.',
    'Magnesium helps with PMS: bananas, pumpkin seeds, chickpeas, leafy greens.',
    'Go easy on salt and caffeine this week. 2.5–3 L of water actually reduces bloating.'
  ]
}

export function nudgeText(kind, p, cycle, today = '2026-01-01') {
  const tone = p.tone || 'bestie'
  const name = p.name ? p.name.split(' ')[0] : ''
  const hi = tone === 'bestie' ? `Hey ${name || 'babe'}! ` : tone === 'gentle' ? `Hi${name ? ` ${name}` : ''}. ` : ''
  const heart = tone === 'facts' ? '' : ' 💜'

  switch (kind) {
    case 'period_heads_up':
      return tone === 'facts'
        ? 'Your period is expected in about 2 days. Keep pads or a cup handy.'
        : `${hi}Your period might show up in the next couple of days. Keep your pads or cup handy and go easy on yourself${heart}`
    case 'period_check':
      return tone === 'facts'
        ? 'Did your period start? Reply "started today" or "not yet".'
        : `${hi}Did your period start? Just reply "started today" or "not yet" and I'll handle the rest${heart}`
    case 'period_end_check':
      return tone === 'facts'
        ? 'Day 4 of your period. Is it over, or still going?'
        : `${hi}It's day 4 of your period. Is it over, or still going?`
    case 'weekly_checkin': {
      const where = PHASE_WORDS[cycle.phase] ?? 'this week'
      const q = cycle.lateLuteal
        ? '1) Any bloating, cramps or headaches? 2) How\'s your mood, honestly? PMS days can feel heavy. 3) How are you sleeping?'
        : '1) How\'s your body feeling? 2) How\'s your mood? 3) How are you sleeping?'
      const lead = cycle.mode === 'cycle' ? `Weekly check-in for ${where}.` : 'Weekly check-in.'
      return tone === 'facts' ? `${lead} ${q}` : `${hi}${lead} ${q} Answer whatever you like${heart}`
    }
    case 'daily_tip': {
      const list = TIPS[cycle.phase] ?? ['Drink some water, stretch for a minute, and check in with how you feel today.']
      const pick = list[Math.abs(daysBetween('2026-01-01', today)) % list.length]
      return tone === 'facts' ? pick.replace(/ 💜|!/g, '.').replace(/\.\./g, '.') : `${hi}${pick}`
    }
  }
  return ''
}

// ---------- Partner mode ----------
// The partner only ever learns: her phase (when she has natural phases), a period heads-up,
// a tip on how to support her, and (if she allows it) that she's having a hard time.
// Never her chats, logs, symptoms, a late period, pregnancy or anything she said.

export const PARTNER_DAILY_CAP = 2

export const PARTNER_PHASES = {
  menstrual: { label: 'Period week', about: 'Her energy is usually at its lowest. Cramps and tiredness are common.' },
  follicular: { label: 'Rising energy', about: 'Energy and mood usually pick up this week.' },
  ovulatory: { label: 'Peak energy', about: 'Usually her most energetic, social days of the month.' },
  luteal: { label: 'Slowing down', about: 'She may feel more tired, hungry or sensitive than usual.' },
  pms: { label: 'PMS days', about: 'Mood can dip and her body may feel heavy. Patience goes a long way.' }
}

const PARTNER_TIPS = {
  menstrual: [
    'Offer a hot water bag and something warm to eat, like dal khichdi or ginger tea.',
    'Take one chore off her plate today without being asked.',
    'Ask "what would help right now?" instead of guessing.'
  ],
  follicular: [
    'Good week to plan something together: a walk, a new café, a movie night.',
    'She may be up for trying new things. Suggest that plan you keep postponing.',
    'Cheer on whatever she is starting this week.'
  ],
  ovulatory: [
    'Make plans. This is usually her most social, confident stretch.',
    'A sincere compliment lands well this week.',
    'Join her for a workout or a long walk if she is up for it.'
  ],
  luteal: [
    'Keep plans low-key and be a little more patient than usual.',
    'Stock her comfort snacks, and maybe some dark chocolate or bananas.',
    'If she is quieter than usual, a simple "I am here" helps more than fixing things.'
  ],
  pms: [
    "Don't take mood swings personally. Listen more than you talk today.",
    'A hot water bag, a cosy night in and her favourite food go a long way.',
    'Check in with a short, kind message during the day.'
  ],
  general: [
    'Ask her how she is really doing today, and listen.',
    'Small things count: water, a snack, a hug, a chore done without asking.',
    'Plan a calm evening together this week.'
  ]
}

// Which bucket of partner tips applies. Anything private (late period, pregnancy,
// menopause, contraception) falls back to 'general' so the partner learns nothing from it.
export function partnerPhase(cycle) {
  if (cycle?.mode !== 'cycle' || !cycle.phase || cycle.phase === 'late') return null
  if (cycle.lateLuteal) return 'pms'
  return cycle.phase
}

function firstName(p) {
  return (p?.name || '').trim().split(/\s+/)[0] || 'your partner'
}

function pickFor(list, today) {
  return list[Math.abs(daysBetween('2026-01-01', today)) % list.length]
}

// What the partner screen shows.
export function partnerView(her, cycle, today) {
  const key = partnerPhase(cycle)
  const ph = key ? PARTNER_PHASES[key] : null
  return {
    her_name: firstName(her),
    phase: key,
    phase_label: ph?.label ?? null,
    about: ph?.about ?? null,
    tip: pickFor(PARTNER_TIPS[key ?? 'general'], today)
  }
}

export function partnerText(kind, her, cycle, today) {
  const name = firstName(her)
  if (kind === 'partner_heads_up') {
    return `Heads-up: ${name}'s period may start in the next couple of days. A hot water bag, her comfort snacks and a little extra patience go a long way 💜`
  }
  if (kind === 'partner_tip') {
    const key = partnerPhase(cycle)
    const lead = key ? `${name}'s week: ${PARTNER_PHASES[key].label.toLowerCase()}. ` : `This week with ${name}: `
    return lead + pickFor(PARTNER_TIPS[key ?? 'general'], today)
  }
  if (kind === 'partner_crisis') {
    return `${name} is having a really hard time right now. Please check on her: call her, or be with her if you can 💜`
  }
  return ''
}

/**
 * Decide the one partner nudge to send now, or null.
 * Timing follows HER settings (timezone, reminder time, quiet hours, pause).
 * @param her    her profile row
 * @param link   partner_links row
 * @param starts her period start dates
 * @param sent   [{kind, for_date}] already sent to the partner recently
 */
export function duePartnerNudge(her, link, starts, sent, now) {
  if (!link?.partner_id) return null
  const clock = localClock(now, her.timezone || 'Asia/Kolkata')
  const today = clock.date
  if (her.paused_until && new Date(her.paused_until) > now) return null
  if (inQuietHours(clock.minutes, toMinutes(her.quiet_start, 22 * 60), toMinutes(her.quiet_end, 8 * 60))) return null
  if (clock.minutes < toMinutes(her.nudge_time, 9 * 60)) return null

  const sentToday = sent.filter(s => s.for_date === today)
  if (sentToday.filter(s => s.kind !== 'partner_crisis').length >= PARTNER_DAILY_CAP) return null

  const cycle = computeCycle(her, starts, today)
  const candidates = []
  if (link.notify_heads_up && cycle.mode === 'cycle' && cycle.phase !== 'late' &&
      daysBetween(today, cycle.nextPeriod.expected) === 2) candidates.push('partner_heads_up')
  if (link.notify_tips && clock.weekday === (her.checkin_day ?? 0)) candidates.push('partner_tip')

  const kind = candidates.find(k => !sentToday.some(s => s.kind === k))
  if (!kind) return null
  return { kind, for_date: today, text: partnerText(kind, her, cycle, today) }
}

export { WEEKDAY_NAMES }
