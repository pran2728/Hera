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

export { WEEKDAY_NAMES }
