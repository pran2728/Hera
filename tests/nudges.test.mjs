import assert from 'node:assert/strict'
import { dueNudge, localClock, inQuietHours, nudgeText } from '../src/lib/nudges.js'
import { computeCycle } from '../src/lib/cycle.js'

const base = { id: 'u1', name: 'Pran', life_stage: 'cycles', cycle_length: 28, cycle_length_known: true, period_length: 5,
  tone: 'bestie', timezone: 'Asia/Kolkata', nudge_time: '09:00', quiet_start: '22:00', quiet_end: '08:00', checkin_day: 0, podcast_picks: false }
// 10:00 IST on a given date = 04:30 UTC
const at = (date, hhmm = '10:00') => { const [h, m] = hhmm.split(':').map(Number); return new Date(Date.parse(date + 'T00:00:00Z') + ((h * 60 + m) - 330) * 60000) }

assert.deepEqual(localClock(at('2026-09-29', '01:30'), 'Asia/Kolkata'), { date: '2026-09-29', minutes: 90, weekday: 2 })
assert.equal(inQuietHours(23 * 60, 22 * 60, 8 * 60), true)
assert.equal(inQuietHours(7 * 60, 22 * 60, 8 * 60), true)
assert.equal(inQuietHours(12 * 60, 22 * 60, 8 * 60), false)

const starts = ['2026-09-28'] // expected next: 2026-10-26 (a Monday)
// Heads-up 2 days before (Sat 24 Oct)
assert.equal(dueNudge(base, starts, [], [], at('2026-10-24')).kind, 'period_heads_up')
// Before nudge time: nothing
assert.equal(dueNudge(base, starts, [], [], at('2026-10-24', '08:30')), null)
// Quiet hours: nothing
assert.equal(dueNudge(base, starts, [], [], at('2026-10-24', '23:00')), null)
// Expected day and 2 days after: "did it start?"; not on the day between
assert.equal(dueNudge(base, starts, [], [], at('2026-10-26')).kind, 'period_check')
assert.equal(dueNudge(base, starts, [], [], at('2026-10-27')), null)
assert.equal(dueNudge(base, starts, [], [], at('2026-10-28')).kind, 'period_check')
// Once logged, the check stops (new start = 26 Oct, so 28 Oct is day 3)
assert.equal(dueNudge(base, [...starts, '2026-10-26'], [], [], at('2026-10-28')), null)
// Day 4: "is it over?" unless she logged an end
assert.equal(dueNudge(base, starts, [], [], at('2026-10-01')).kind, 'period_end_check')
assert.equal(dueNudge(base, starts, ['2026-09-30'], [], at('2026-10-01')), null)
// Weekly check-in on her day (Sunday 4 Oct), only once
assert.equal(dueNudge(base, starts, [], [], at('2026-10-04')).kind, 'weekly_checkin')
assert.equal(dueNudge(base, starts, [], [{ kind: 'weekly_checkin', for_date: '2026-10-04' }], at('2026-10-04', '10:15')), null)
// Daily tips only when opted in, once a day
assert.equal(dueNudge(base, starts, [], [], at('2026-10-07')), null)
assert.equal(dueNudge({ ...base, daily_tips: true }, starts, [], [], at('2026-10-07')).kind, 'daily_tip')
// Two due on one day: the second comes on the next run
const both = { ...base, daily_tips: true }
assert.equal(dueNudge(both, starts, [], [{ kind: 'weekly_checkin', for_date: '2026-10-04' }], at('2026-10-04', '10:15')).kind, 'daily_tip')
// Daily cap
assert.equal(dueNudge(both, starts, [], [1, 2, 3].map(i => ({ kind: 'x' + i, for_date: '2026-10-04' })), at('2026-10-04')), null)
// Paused
assert.equal(dueNudge({ ...base, paused_until: '2026-10-30T00:00:00Z' }, starts, [], [], at('2026-10-24')), null)
// No cycle nudges on the combined pill, but check-ins still come
assert.equal(dueNudge({ ...base, contraception: 'combined' }, starts, [], [], at('2026-10-24')), null)
assert.equal(dueNudge({ ...base, contraception: 'combined' }, starts, [], [], at('2026-10-04')).kind, 'weekly_checkin')
// Other timezone: 10:00 IST is 06:30 in Dubai-ish? use UTC user at 04:30 -> before 09:00
assert.equal(dueNudge({ ...base, timezone: 'UTC' }, starts, [], [], at('2026-10-24')), null)

// Texts follow her tone
const cyc = computeCycle(base, starts, '2026-10-26')
assert.match(nudgeText('period_check', base, cyc), /^Hey Pran! Did your period start\?/)
assert.doesNotMatch(nudgeText('period_check', { ...base, tone: 'facts' }, cyc), /babe|💜|Hey/)
assert.match(nudgeText('weekly_checkin', base, computeCycle(base, starts, '2026-10-22')), /PMS/)
assert.ok(nudgeText('daily_tip', { ...base, tone: 'facts' }, computeCycle(base, starts, '2026-10-01'), '2026-10-01').length > 10)
console.log('all nudge tests passed')

// ---------- Partner mode ----------
{
  const { duePartnerNudge, partnerView, partnerText, partnerPhase } = await import('../src/lib/nudges.js')
  const her = { ...base, name: 'Pran Josyula' }
  const link = { partner_id: 'p1', notify_heads_up: true, notify_tips: true, notify_crisis: true }
  // Not accepted yet: nothing
  assert.equal(duePartnerNudge(her, { ...link, partner_id: null }, starts, [], at('2026-10-24')), null)
  // Heads-up 2 days before her period, with her first name
  const hu = duePartnerNudge(her, link, starts, [], at('2026-10-24'))
  assert.equal(hu.kind, 'partner_heads_up')
  assert.match(hu.text, /^Heads-up: Pran's period/)
  // Respects her switch, her quiet hours, her reminder time and her pause
  assert.equal(duePartnerNudge(her, { ...link, notify_heads_up: false }, starts, [], at('2026-10-24')), null)
  assert.equal(duePartnerNudge(her, link, starts, [], at('2026-10-24', '23:00')), null)
  assert.equal(duePartnerNudge(her, link, starts, [], at('2026-10-24', '08:30')), null)
  assert.equal(duePartnerNudge({ ...her, paused_until: '2026-12-01T00:00:00Z' }, link, starts, [], at('2026-10-24')), null)
  // Weekly tip on her check-in day, once
  assert.equal(duePartnerNudge(her, link, starts, [], at('2026-10-04')).kind, 'partner_tip')
  assert.equal(duePartnerNudge(her, link, starts, [{ kind: 'partner_tip', for_date: '2026-10-04' }], at('2026-10-04')), null)
  assert.equal(duePartnerNudge(her, { ...link, notify_tips: false }, starts, [], at('2026-10-04')), null)
  // Never a heads-up when she's late (that's private), and no phase shown
  const lateCycle = computeCycle(her, starts, '2026-11-10')
  assert.equal(lateCycle.phase, 'late')
  assert.equal(partnerPhase(lateCycle), null)
  assert.equal(partnerView(her, lateCycle, '2026-11-10').phase_label, null)
  // Pregnant / hormonal contraception: partner sees no phase, tips stay general
  assert.equal(partnerView({ ...her, life_stage: 'pregnant' }, computeCycle({ ...her, life_stage: 'pregnant' }, starts, '2026-10-04'), '2026-10-04').phase, null)
  assert.match(partnerText('partner_tip', her, { mode: 'pregnant' }, '2026-10-04'), /^This week with Pran: /)
  // PMS days get their own wording; tips never mention logs or symptoms she reported
  const pms = computeCycle(her, starts, '2026-10-22')
  assert.equal(partnerPhase(pms), 'pms')
  assert.equal(partnerView(her, pms, '2026-10-22').phase_label, 'PMS days')
  assert.match(partnerText('partner_crisis', her, pms, '2026-10-22'), /Pran is having a really hard time/)
  // Partner gets at most 2 a day
  assert.equal(duePartnerNudge(her, link, starts, [{ kind: 'a', for_date: '2026-10-04' }, { kind: 'b', for_date: '2026-10-04' }], at('2026-10-04')), null)
  console.log('partner nudges: ok')
}

// ---------- Life-stage reminders ----------
{
  const { dueNudge, nudgeText } = await import('../src/lib/nudges.js')
  // TTC: fertile window first day (28-day cycle from 28 Sep -> window 6-11 Oct)
  const ttc = { ...base, life_stage: 'ttc' }
  const f = dueNudge(ttc, starts, [], [], at('2026-10-06'))
  assert.equal(f.kind, 'fertile_start')
  assert.match(f.text, /fertile window likely starts today and runs until Sun, 11 Oct/)
  assert.equal(dueNudge(base, starts, [], [], at('2026-10-06')), null) // not for cycle tracking
  assert.match(dueNudge(ttc, starts, [], [], at('2026-10-04')).text, /folic acid/)
  // Pregnancy: weekly update with week and size; no period reminders at all
  const preg = { ...base, life_stage: 'pregnant', due_date: '2027-04-01' }
  const pw = dueNudge(preg, starts, [], [], at('2026-10-11')) // a Sunday
  assert.equal(pw.kind, 'weekly_checkin')
  assert.match(pw.text, /^Hey Pran! Week 15! Baby is about the size of an apple\./)
  for (const d of ['2026-10-24', '2026-10-26', '2026-10-28']) assert.equal(dueNudge(preg, starts, [], [], at(d)), null)
  assert.match(dueNudge({ ...preg, due_date: null }, [], [], [], at('2026-10-11')).text, /Tell me your due date/)
  assert.match(nudgeText('daily_tip', { ...preg, daily_tips: true }, { mode: 'pregnant', pregnancy: { trimester: 3 } }, '2026-10-11'),
    /side|movement|swelling/)
  // Menopause: symptom check-in and bone tips that fit her diet
  const meno = { ...base, life_stage: 'postmenopause', diet: 'vegan' }
  assert.match(dueNudge(meno, [], [], [], at('2026-10-11')).text, /hot flushes or night sweats/)
  const tips = [0, 1, 2, 3].map(i => nudgeText('daily_tip', meno, { mode: 'menopause' }, `2026-01-0${i + 1}`))
  assert.ok(tips.some(t => /ragi/.test(t)) && tips.every(t => !/paneer|curd|egg/i.test(t)))
  console.log('stage reminders: ok')
}

// ---------- Partner calendar + podcast reminders ----------
{
  const { partnerView, dueNudge } = await import('../src/lib/nudges.js')
  const her = { ...base }
  const onPeriod = computeCycle(her, ['2026-10-08'], '2026-10-10')
  let v = partnerView(her, onPeriod, '2026-10-10', true)
  assert.deepEqual(v.next_period, { from: '2026-11-02', to: '2026-11-08', rough: false })
  assert.deepEqual(v.period_now, { from: '2026-10-08', to: '2026-10-12' })
  assert.equal(partnerView(her, onPeriod, '2026-10-10', false).next_period, null) // her switch off
  assert.equal(partnerView(her, computeCycle(her, ['2026-08-01'], '2026-10-10'), '2026-10-10', true).next_period, null) // late: hidden
  assert.equal(partnerView({ ...her, life_stage: 'pregnant' }, { mode: 'pregnant' }, '2026-10-10', true).next_period, null)
  // Podcast every 3rd day, with a real link; off when she turns it off
  const pod = dueNudge({ ...base, checkin_day: 9, podcast_picks: true }, ['2026-09-20'], [], [], at('2026-10-10')) // 2026-10-10 is day 282 => 282 % 3 = 0
  assert.equal(pod.kind, 'podcast'); assert.match(pod.text, /^Hey Pran! Podcast pick for the next few days 🎧 .+ https:\/\//)
  assert.equal(dueNudge({ ...base, checkin_day: 9, podcast_picks: false }, ['2026-09-20'], [], [], at('2026-10-10')), null)
  assert.equal(dueNudge({ ...base, checkin_day: 9, podcast_picks: true }, ['2026-09-20'], [], [], at('2026-10-11')), null)
  console.log('partner calendar + podcasts: ok')
}

// ---------- Birthday ----------
{
  const { dueNudge } = await import('../src/lib/nudges.js')
  const b = dueNudge({ ...base, birth_date: '2000-10-12', checkin_day: 9 }, ['2026-09-20'], [], [], at('2026-10-12'))
  assert.equal(b.kind, 'birthday'); assert.match(b.text, /^Happy birthday, Pran! 🎂💜 26 looks good on you\./)
  assert.equal(dueNudge({ ...base, birth_date: '2000-10-12', checkin_day: 9 }, ['2026-09-20'], [], [{ kind: 'birthday', for_date: '2026-10-12' }], at('2026-10-12')), null)
  assert.equal(dueNudge({ ...base, birth_date: '2000-10-12', checkin_day: 9 }, ['2026-09-20'], [], [], at('2026-10-12', '07:00')), null) // not during quiet hours
  console.log('birthday: ok')
}
