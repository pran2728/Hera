import assert from 'node:assert/strict'
import { computeCycle } from '../src/lib/cycle.js'
import { predictionStrip, phaseCard } from '../src/lib/home.js'

const today = '2026-11-22'
const profile = { life_stage: 'cycles', cycle_length: 28, cycle_length_known: true, period_length: 5, diet: 'vegetarian' }
// Four logged periods, 28 days apart; the last on 5 Nov → day 18 today, next expected 3 Dec.
const starts = ['2026-08-13', '2026-09-10', '2026-10-08', '2026-11-05']
const c = computeCycle(profile, starts, today)
assert.equal(c.day, 18)

const s = predictionStrip(c, today)
assert.equal(s.expected, '2026-12-03')
assert.equal(s.inDays, 11)
assert.deepEqual(s.days.map(d => d.n), [30, 1, 2, 3, 4, 5, 6])
assert.deepEqual(s.days.map(d => d.level), [null, 'likely', 'likely', 'most', 'likely', 'likely', null])
assert.equal(s.days[3].letter, 'T') // Thu 3 Dec
assert.equal(s.pmsFrom, '2026-11-26')
assert.match(s.basedOn, /logged periods/); assert.equal(s.range, '1–5 Dec')

const card = phaseCard(c, profile)
assert.equal(card.name, 'Luteal: slow and steady')
assert.equal(card.bar.seg.length, 4)
assert.ok(card.bar.marker > 0.55 && card.bar.marker < 0.7, String(card.bar.marker))
assert.ok(card.tips[0].startsWith('Eat: '), card.tips[0])
assert.equal(card.tips.length, 3)

// PMS days near the end of the cycle
const pms = phaseCard(computeCycle(profile, starts, '2026-11-29'), profile)
assert.equal(pms.name, 'PMS days: be gentle')

// Vegan: no dairy or egg suggestions
const vegan = phaseCard(c, { ...profile, diet: 'vegan' })
assert.ok(!/curd|milk|paneer|egg|ghee/i.test(vegan.tips[0]), vegan.tips[0])

// On her period: the strip is about the next one, and PMS isn't mentioned
const onPeriod = computeCycle(profile, starts, '2026-11-06')
assert.equal(phaseCard(onPeriod, profile).name, 'Period: rest and restore')
assert.equal(predictionStrip(onPeriod, '2026-11-06').pmsFrom, null)

// Late, pregnant, unknown: no strip; late gets an explanation card
const late = computeCycle(profile, starts, '2026-12-12')
assert.equal(predictionStrip(late, '2026-12-12'), null)
assert.equal(phaseCard(late, profile).name, 'Running late')
assert.equal(predictionStrip(computeCycle({ life_stage: 'pregnant' }, [], today), today), null)
assert.equal(phaseCard(computeCycle(profile, [], today), profile), null)
console.log('home tests passed')
