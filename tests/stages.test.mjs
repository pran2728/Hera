import assert from 'node:assert/strict'
import { computeCycle, pregnancyWeek, describeCycle } from '../src/lib/cycle.js'
import { pregnancyGuide, ttcInfo, symptomSummary, describeSymptoms, sexDrivePattern, boneFoods, validDueDate, describeStage, SOURCES, STAGE_SOURCES } from '../src/lib/stages.js'

// ---- Pregnancy weeks ----
const due = '2027-04-01'
let w = pregnancyWeek({ due_date: due }, '2026-10-10') // 173 days to go -> 107 days along
assert.deepEqual([w.week, w.day, w.trimester, w.toGo, w.estimated], [15, 2, 2, 173, false])
assert.equal(pregnancyWeek({ due_date: due }, '2026-07-09').week, 2)
assert.equal(pregnancyWeek({ due_date: due }, '2027-04-01').week, 40)
assert.equal(pregnancyWeek({ due_date: due }, '2027-04-15').week, 42) // past due still counts
assert.equal(pregnancyWeek({ due_date: due }, '2026-01-01'), null)     // before conception: nonsense
// No due date: last period + 280 days, marked as estimated
w = pregnancyWeek({ last_period_start: '2026-09-01' }, '2026-10-10')
assert.deepEqual([w.week, w.due, w.estimated], [5, '2027-06-08', true])
assert.equal(pregnancyWeek({}, '2026-10-10'), null)
// computeCycle carries it; the prompt mentions it
const pc = computeCycle({ life_stage: 'pregnant', due_date: due }, [], '2026-10-10')
assert.equal(pc.pregnancy.week, 15)
assert.match(describeCycle(pc), /15 weeks 2 days \(trimester 2\), due Thu 1 Apr/)
assert.match(describeCycle(computeCycle({ life_stage: 'pregnant' }, [], '2026-10-10')), /due date unknown/)
// Guide by week
assert.equal(pregnancyGuide({ week: 15 }).title, 'The second trimester')
assert.equal(pregnancyGuide({ week: 15 }).size, 'an apple')
assert.equal(pregnancyGuide({ week: 2 }).size, 'a poppy seed (khus khus)')
assert.equal(pregnancyGuide({ week: 42 }).title, 'Past your due date')
for (let k = 0; k <= 45; k++) assert.ok(pregnancyGuide({ week: k }).focus, `week ${k} has guidance`)
assert.equal(validDueDate('2027-04-01', '2026-10-10'), true)
assert.equal(validDueDate('2028-04-01', '2026-10-10'), false)
assert.equal(validDueDate('soon', '2026-10-10'), false)

// ---- Trying to conceive ----
const ttc = { life_stage: 'ttc', ttc_since: '2026-01-01', age: 30, cycle_length: 28, cycle_length_known: true, conditions: [] }
const cyc = computeCycle(ttc, ['2026-10-01'], '2026-10-10')
let t = ttcInfo(ttc, cyc, '2026-10-10')
assert.deepEqual([t.months, t.limit, t.seeDoctor, t.earlyCheck], [9, 12, false, false])
assert.deepEqual(t.fertile, { from: '2026-10-09', to: '2026-10-14' })
assert.equal(ttcInfo({ ...ttc, age: 36 }, cyc, '2026-10-10').seeDoctor, true) // 6 months at 35+
assert.equal(ttcInfo({ ...ttc, conditions: ['PCOS/PCOD'] }, cyc, '2026-10-10').earlyCheck, true)
assert.equal(ttcInfo({ ...ttc, ttc_since: null }, cyc, '2026-10-10').months, null)
assert.match(describeStage(ttc, cyc, [], '2026-10-10'), /Trying to conceive for about 9 months\. Estimated fertile window/)

// ---- Menopause symptoms ----
const L = (log_date, kind, value) => ({ log_date, kind, value })
const logs = [
  L('2026-10-09', 'hot_flash'), L('2026-10-09', 'hot_flash'), L('2026-10-05', 'hot_flash'),
  L('2026-10-08', 'night_sweat'), L('2026-10-07', 'sleep', 'poor sleep'), L('2026-10-06', 'sleep', '7 hours, great'),
  L('2026-10-06', 'mood', 'irritable'), L('2026-10-04', 'symptom', 'Joint pain'), L('2026-10-03', 'symptom', 'joint pain'),
  L('2026-10-03', 'symptom', 'headache'), L('2026-08-01', 'hot_flash') // too old
]
const s = symptomSummary(logs, '2026-10-10')
assert.deepEqual([s.hot_flash, s.night_sweat, s.poor_sleep, s.low_mood, s.top[0]], [2, 1, 1, 1, 'joint pain'])
assert.match(describeSymptoms(s), /hot flushes on 2 days; night sweats on 1 days; poor sleep on 1 days; low mood on 1 days; also: joint pain, headache/)
assert.match(describeSymptoms(symptomSummary([], '2026-10-10')), /Nothing logged/)
assert.ok(boneFoods('vegan').every(f => !/curd|paneer|egg|fish/i.test(f)))
assert.ok(boneFoods('jain').every(f => !/egg|fish|onion|garlic/i.test(f)))
assert.ok(boneFoods('unknown').length >= 4)

// ---- Sex drive pattern ----
const me = { life_stage: 'cycles', cycle_length: 28, cycle_length_known: true, period_length: 5 }
const sd = [L('2026-09-01', 'period_start'), L('2026-09-29', 'period_start'),
  L('2026-09-02', 'sex_drive', 'low'), L('2026-09-14', 'sex_drive', 'high'), L('2026-09-15', 'sex_drive', 'High'),
  L('2026-09-24', 'sex_drive', 'normal'), L('2026-09-30', 'sex_drive', 'low')]
const pat = sexDrivePattern(me, sd)
assert.equal(pat.count, 5); assert.equal(pat.high, 'ovulatory'); assert.equal(pat.low, 'menstrual')
assert.equal(pat.text, 'Your sex drive tends to be highest around ovulation and lowest on your period.')
assert.equal(sexDrivePattern(me, sd.slice(0, 4)), null) // too few
// Works for her history even after she switches to pregnancy mode
assert.equal(sexDrivePattern({ ...me, life_stage: 'pregnant' }, sd).high, 'ovulatory')
assert.match(describeStage(me, computeCycle(me, ['2026-09-29'], '2026-10-10'), sd, '2026-10-10'), /Her sex drive tends to be highest around ovulation and lowest on her period/)

// ---- Sources ----
for (const keys of Object.values(STAGE_SOURCES)) for (const k of keys) assert.ok(SOURCES[k]?.url.startsWith('https://'), k)
console.log('all stage tests passed')
