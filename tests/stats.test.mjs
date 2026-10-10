import assert from 'node:assert/strict'
import { cycleHistory, periodLengths, trend, painByCycle, cycleTrends, symptomStats, describeTrends } from '../src/lib/stats.js'
import { podcastFor, isPodcastDay, podcastBucket, PODCASTS } from '../src/lib/podcasts.js'
import { computeCycle } from '../src/lib/cycle.js'

const starts = ['2026-04-01', '2026-04-29', '2026-05-27', '2026-06-25', '2026-07-26', '2026-08-27', '2026-09-29']
const c = cycleHistory([...starts, '2026-09-29', '2026-03-01'].concat(['2025-01-01']))
assert.deepEqual(c.map(x => x.length), [31, 28, 28, 29, 31, 32, 33]) // 2025 gap ignored, duplicate ignored
assert.deepEqual(trend([28, 28, 29, 31, 32, 33]), { direction: 'up', diff: 3.7 })
assert.deepEqual(trend([30, 29, 30, 29]), { direction: 'steady', diff: -0.7 })
assert.equal(trend([28, 30, 31]), null)
assert.deepEqual(periodLengths(starts, ['2026-04-05', '2026-05-02', '2026-09-30']).map(p => p.length), [5, 4, 2])
const logs = [
  { log_date: '2026-04-02', kind: 'pain', value: '7' }, { log_date: '2026-04-03', kind: 'pain', value: '5, lower back' },
  { log_date: '2026-04-30', kind: 'pain', value: '6' }, { log_date: '2026-05-28', kind: 'pain', value: '6' },
  { log_date: '2026-08-28', kind: 'pain', value: '3' }, { log_date: '2026-09-30', kind: 'pain', value: '2' }, { log_date: '2026-09-30', kind: 'pain', value: 'bad' },
  { log_date: '2026-09-20', kind: 'symptom', value: 'Bloating' }, { log_date: '2026-09-21', kind: 'symptom', value: 'bloating' },
  { log_date: '2026-09-22', kind: 'symptom', value: 'acne' }, { log_date: '2026-09-23', kind: 'mood', value: 'irritable' },
  { log_date: '2026-09-24', kind: 'mood', value: 'Irritable' }, { log_date: '2026-09-25', kind: 'mood', value: 'happy' },
  { log_date: '2026-09-25', kind: 'energy', value: 'low' }, { log_date: '2026-05-01', kind: 'symptom', value: 'old' }
]
assert.deepEqual(painByCycle(starts, logs).map(p => p.avg), [6, 6, 6, 3, 2])
const t = cycleTrends(starts, ['2026-04-05'], logs)
assert.equal(t.cycleAvg, 30.2); assert.deepEqual(t.cycleRange, [28, 33]); assert.equal(t.regular, true)
assert.equal(t.painTrend.direction, 'down')
const s = symptomStats(logs, '2026-10-10')
assert.deepEqual(s.symptoms[0], { name: 'bloating', count: 2 }); assert.equal(s.moods[0].name, 'irritable')
assert.equal(s.painAvg, 2.5); assert.equal(s.painDays, 2); assert.equal(s.painMax, 3); assert.ok(!s.symptoms.some(x => x.name === 'old'))
assert.match(describeTrends(t, s), /average cycle 30.2 days \(range 28-33\), getting longer; periods last about 5 days; period-cycle pain averages 4.6\/10, easing; most logged symptoms \(90 days\): bloating, acne; most common mood: irritable/)
assert.equal(describeTrends(cycleTrends([], [], []), symptomStats([], '2026-10-10')), '')

// Podcasts: same pick for 3 days, matched to phase or life stage, always a real show
const me = { life_stage: 'cycles', cycle_length: 28, cycle_length_known: true, period_length: 5 }
const cyc = d => computeCycle(me, ['2026-10-01'], d)
assert.equal(podcastBucket(me, cyc('2026-10-02')), 'menstrual')
assert.equal(podcastBucket(me, cyc('2026-10-25')), 'pms')
assert.equal(podcastBucket({ life_stage: 'pregnant' }, { mode: 'pregnant' }), 'pregnant')
assert.equal(podcastBucket({ life_stage: 'postmenopause' }, { mode: 'menopause' }), 'menopause')
assert.equal(podcastBucket(me, computeCycle(me, ['2026-08-01'], '2026-10-10')), 'general') // late: nothing revealing
assert.equal(isPodcastDay('2026-01-01'), true); assert.equal(isPodcastDay('2026-01-02'), false); assert.equal(isPodcastDay('2026-01-04'), true)
const p1 = podcastFor({ life_stage: 'pregnant' }, { mode: 'pregnant' }, '2026-01-04')
assert.deepEqual(podcastFor({ life_stage: 'pregnant' }, { mode: 'pregnant' }, '2026-01-06').name, p1.name)
assert.notEqual(podcastFor({ life_stage: 'pregnant' }, { mode: 'pregnant' }, '2026-01-07').name, p1.name)
for (const pod of Object.values(PODCASTS)) assert.ok(pod.url.startsWith('https://') && pod.name)
console.log('all stats and podcast tests passed')

// Today's line
{
  const { lineFor, lineBucket, LINES } = await import('../src/lib/quotes.js')
  const me = { life_stage: 'cycles', cycle_length: 28, cycle_length_known: true, period_length: 5 }
  const at = d => computeCycle(me, ['2026-10-01'], d)
  assert.equal(lineBucket(me, at('2026-10-02')), 'menstrual')
  assert.equal(lineBucket(me, at('2026-10-24')), 'pms')
  assert.equal(lineBucket({ ...me, life_stage: 'ttc' }, at('2026-10-18')), 'ttc_wait')
  assert.equal(lineBucket({ life_stage: 'pregnant' }, { mode: 'pregnant' }), 'pregnant')
  assert.equal(lineBucket(me, computeCycle(me, ['2026-08-01'], '2026-10-10')), 'general') // late: nothing that hints
  assert.notEqual(lineFor(me, at('2026-10-02'), '2026-10-02'), lineFor(me, at('2026-10-03'), '2026-10-03')) // new line each day
  for (const list of Object.values(LINES)) for (const l of list) assert.ok(l.length < 140 && !/[\u{1F300}-\u{1FAFF}]/u.test(l), l)
  console.log('daily lines: ok')
}
