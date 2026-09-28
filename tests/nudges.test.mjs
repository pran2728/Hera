import assert from 'node:assert/strict'
import { dueNudge, localClock, inQuietHours, nudgeText } from '../src/lib/nudges.js'
import { computeCycle } from '../src/lib/cycle.js'

const base = { id: 'u1', name: 'Pran', life_stage: 'cycles', cycle_length: 28, cycle_length_known: true, period_length: 5,
  tone: 'bestie', timezone: 'Asia/Kolkata', nudge_time: '09:00', quiet_start: '22:00', quiet_end: '08:00', checkin_day: 0 }
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
