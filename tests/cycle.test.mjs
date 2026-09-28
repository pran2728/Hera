import assert from 'node:assert/strict'
import { computeCycle, describeCycle, prettyDate } from '../src/lib/cycle.js'

const base = { life_stage: 'cycles', cycle_length: 28, cycle_length_known: true, period_length: 5 }
let c

// Period started today -> menstrual day 1
c = computeCycle(base, ['2026-09-28'], '2026-09-28')
assert.equal(c.day, 1); assert.equal(c.phase, 'menstrual')
assert.equal(c.nextPeriod.expected, '2026-10-26')
assert.equal(c.nextPeriod.from, '2026-10-23'); assert.equal(c.nextPeriod.to, '2026-10-29')

// Day 8 -> follicular, day 14 -> ovulatory, day 20 -> luteal, day 25 -> late luteal
assert.equal(computeCycle(base, ['2026-09-01'], '2026-09-08').phase, 'follicular')
assert.equal(computeCycle(base, ['2026-09-01'], '2026-09-14').phase, 'ovulatory')
assert.equal(computeCycle(base, ['2026-09-01'], '2026-09-20').phase, 'luteal')
c = computeCycle(base, ['2026-09-01'], '2026-09-25'); assert.equal(c.lateLuteal, true)

// Late
c = computeCycle(base, ['2026-08-01'], '2026-09-10'); assert.equal(c.phase, 'late'); assert.equal(c.lateBy, 13)

// History average: 30-day cycles, regular -> spread 2
c = computeCycle(base, ['2026-06-01', '2026-07-01', '2026-07-31', '2026-08-30'], '2026-09-02')
assert.equal(c.cycleLength, 30); assert.equal(c.rough, false)
assert.equal(c.nextPeriod.to, '2026-10-01')

// Irregular history -> rough
c = computeCycle(base, ['2026-05-01', '2026-05-25', '2026-07-05', '2026-08-01'], '2026-08-05')
assert.equal(c.irregular, true); assert.equal(c.rough, true)

// PCOS -> rough; combined pill -> no phases; pregnant; postmenopause
assert.equal(computeCycle({ ...base, conditions: ['PCOS/PCOD'] }, ['2026-09-01'], '2026-09-05').rough, true)
assert.equal(computeCycle({ ...base, contraception: 'combined' }, ['2026-09-01'], '2026-09-05').mode, 'no_phases')
assert.equal(computeCycle({ ...base, contraception: 'copper_iud' }, ['2026-09-01'], '2026-09-05').mode, 'cycle')
assert.equal(computeCycle({ ...base, life_stage: 'pregnant' }, [], '2026-09-05').mode, 'pregnant')
assert.equal(computeCycle({ ...base, life_stage: 'postmenopause' }, [], '2026-09-05').mode, 'menopause')
assert.equal(computeCycle(base, [], '2026-09-05').mode, 'unknown')

// Uses profile.last_period_start when no logs; ignores future dates
c = computeCycle({ ...base, last_period_start: '2026-09-20' }, ['2026-10-10'], '2026-09-28')
assert.equal(c.lastStart, '2026-09-20'); assert.equal(c.day, 9)

// Unknown cycle length -> rough
assert.equal(computeCycle({ ...base, cycle_length_known: false }, ['2026-09-01'], '2026-09-05').rough, true)

assert.equal(prettyDate('2026-09-28'), 'Mon 28 Sep')
console.log(describeCycle(computeCycle(base, ['2026-09-28'], '2026-09-28')))
console.log('all cycle tests passed')
