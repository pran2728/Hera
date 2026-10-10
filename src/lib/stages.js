// Life-stage modes: trying to conceive, pregnancy, perimenopause and menopause, plus sex-drive patterns.
// Pure logic and content, shared by the app, the hera-chat and hera-nudge functions, and the tests.
// Health content here is general guidance pending review by gynaecologists (Milestone 5).
import { computeCycle, daysBetween, prettyDate } from './cycle.js'

// ---------- Trusted sources (the only links Hera shares) ----------
export const SOURCES = {
  pregnancy_weeks: { title: 'Week-by-week guide to pregnancy (NHS)', url: 'https://www.nhs.uk/pregnancy/week-by-week/' },
  pregnancy_food: { title: 'Foods to avoid in pregnancy (NHS)', url: 'https://www.nhs.uk/pregnancy/keeping-well/foods-to-avoid/' },
  pregnancy_vitamins: { title: 'Vitamins and nutrition in pregnancy (NHS)', url: 'https://www.nhs.uk/pregnancy/keeping-well/vitamins-supplements-and-nutrition/' },
  warning_signs: { title: 'Urgent warning signs in and after pregnancy (CDC)', url: 'https://www.cdc.gov/hearher/maternal-warning-signs/index.html' },
  ttc: { title: 'Trying for a baby (NHS)', url: 'https://www.nhs.uk/pregnancy/trying-for-a-baby/' },
  infertility: { title: 'Infertility: when to see a doctor (NHS)', url: 'https://www.nhs.uk/conditions/infertility/' },
  menopause: { title: 'Menopause and perimenopause (NHS)', url: 'https://www.nhs.uk/conditions/menopause/' },
  menopause_symptoms: { title: 'Symptoms of menopause and perimenopause (NHS)', url: 'https://www.nhs.uk/conditions/menopause/symptoms/' },
  bones: { title: 'Keeping bones strong (NHS)', url: 'https://www.nhs.uk/conditions/osteoporosis/prevention/' },
  pcos: { title: 'PCOS, now also called PMOS (NHS)', url: 'https://www.nhs.uk/conditions/polycystic-ovary-syndrome-pcos/' },
  mental_health: { title: 'Tele-MANAS, free mental health helpline 14416 (Govt. of India)', url: 'https://telemanas.mohfw.gov.in/' }
}

export const STAGE_SOURCES = {
  ttc: ['ttc', 'pregnancy_vitamins', 'infertility'],
  pregnant: ['pregnancy_weeks', 'warning_signs', 'pregnancy_food', 'pregnancy_vitamins'],
  perimenopause: ['menopause', 'menopause_symptoms', 'bones'],
  postmenopause: ['menopause', 'menopause_symptoms', 'bones']
}

export const STAGE_NAMES = {
  cycles: 'cycle tracking', ttc: 'trying-to-conceive mode', pregnant: 'pregnancy mode',
  perimenopause: 'perimenopause mode', postmenopause: 'menopause mode'
}

// ---------- Pregnancy ----------
// "About the size of…" by week, using things that are easy to picture in India.
const SIZES = {
  4: 'a poppy seed (khus khus)', 5: 'a sesame seed', 6: 'a masoor dal grain', 7: 'a blueberry', 8: 'a rajma bean',
  9: 'a grape', 10: 'a date (khajoor)', 11: 'a fig (anjeer)', 12: 'a lime', 13: 'a pea pod', 14: 'a lemon',
  15: 'an apple', 16: 'a guava', 17: 'a pomegranate', 18: 'a sweet potato', 19: 'a mango', 20: 'a banana',
  21: 'a carrot', 22: 'a small papaya', 23: 'a big mango', 24: 'a corn cob (bhutta)', 25: 'a cauliflower',
  26: 'a bunch of spinach', 27: 'a cabbage', 28: 'a large brinjal', 29: 'a small bottle gourd (lauki)',
  30: 'a big cabbage', 31: 'a coconut', 32: 'a big lauki', 33: 'a pineapple', 34: 'a small melon',
  35: 'a honeydew melon', 36: 'a large papaya', 37: 'a bunch of bananas', 38: 'a pumpkin', 39: 'a small watermelon',
  40: 'a watermelon'
}

// What matters in each stretch of pregnancy (general guidance, her doctor's advice comes first).
const PREGNANCY_STAGES = [
  { from: 0, to: 8, title: 'The early weeks',
    focus: 'Keep taking folic acid, and book your first check-up with a gynaecologist if you haven\'t yet. Small, frequent meals help with nausea, and resting when you\'re tired is not lazy.' },
  { from: 9, to: 13, title: 'End of the first trimester',
    focus: 'Your doctor will usually suggest a scan around weeks 11 to 13. Ginger, dry toast or khakra can help with nausea. Stay off alcohol and smoking, and check the foods to avoid.' },
  { from: 14, to: 20, title: 'The second trimester',
    focus: 'Energy often comes back now. Your doctor will usually start iron and calcium tablets and plan the anomaly scan around weeks 18 to 20. Gentle walks and prenatal yoga are great.' },
  { from: 21, to: 27, title: 'Feeling those kicks',
    focus: 'You may feel baby move more each week. A glucose test for gestational diabetes is usually done between weeks 24 and 28. Protein and iron at every meal helps.' },
  { from: 28, to: 34, title: 'The third trimester',
    focus: 'Get to know baby\'s usual pattern of movements and tell your doctor right away if it slows or stops. Sleeping on your side is recommended now. Watch for sudden swelling or bad headaches.' },
  { from: 35, to: 40, title: 'Almost there',
    focus: 'Pack your hospital bag, save your hospital\'s number, and talk to your doctor about the signs of labour. Rest as much as you can.' },
  { from: 41, to: 45, title: 'Past your due date',
    focus: 'Lots of babies arrive after the due date. Stay in close touch with your doctor, who will plan the next steps with you.' }
]

// Urgent signs (CDC "Hear Her"): any of these means calling the doctor or going to hospital now.
export const WARNING_SIGNS = [
  'Bleeding or fluid leaking from the vagina',
  'Baby moving less, or not at all',
  'Severe headache that won\'t go away, or blurred vision',
  'Severe belly pain that doesn\'t go away',
  'Sudden swelling of the face or hands',
  'Fever of 38°C (100.4°F) or higher',
  'Trouble breathing, chest pain or a racing heartbeat',
  'Severe vomiting, or not keeping fluids down',
  'Fainting or dizziness',
  'Thoughts of harming yourself or the baby'
]

export function pregnancyGuide(w) {
  if (!w) return null
  const stage = PREGNANCY_STAGES.find(s => w.week >= s.from && w.week <= s.to) ?? PREGNANCY_STAGES.at(-1)
  return { ...stage, size: SIZES[Math.min(Math.max(w.week, 4), 40)] }
}

// ---------- Trying to conceive ----------
// When to see a fertility doctor: after 12 months of trying, or 6 if she's 35 or older.
export function ttcInfo(profile, cycle, today) {
  const since = profile.ttc_since
  const months = since ? Math.max(0, Math.floor(daysBetween(since, today) / 30.4)) : null
  const limit = (profile.age ?? 0) >= 35 ? 6 : 12
  const pcos = (profile.conditions ?? []).some(c => /pcos|pcod/i.test(c))
  return {
    since, months, limit,
    seeDoctor: months !== null && months >= limit,
    // With PCOS/irregular cycles, an early check-up helps rather than waiting the full year.
    earlyCheck: pcos || !!cycle?.irregular,
    fertile: cycle?.mode === 'cycle' && cycle.phase !== 'late' ? cycle.fertileWindow : null
  }
}

// ---------- Perimenopause and menopause ----------
const LOW_MOODS = /low|sad|anxious|irritable|down|teary|angry|lonely/i
const POOR_SLEEP = /poor|bad|broken|woke|awake|insomnia|little|[0-5]\s*h/i

// What she logged in the last N days, counted for the symptom card and the prompt.
export function symptomSummary(logs, today, days = 30) {
  const recent = logs.filter(l => daysBetween(l.log_date, today) >= 0 && daysBetween(l.log_date, today) < days)
  const count = (pred) => new Set(recent.filter(pred).map(l => l.log_date)).size // days, not entries
  const other = {}
  for (const l of recent.filter(l => l.kind === 'symptom' && l.value)) {
    const k = l.value.toLowerCase().trim()
    other[k] = (other[k] ?? 0) + 1
  }
  return {
    days,
    hot_flash: count(l => l.kind === 'hot_flash'),
    night_sweat: count(l => l.kind === 'night_sweat'),
    poor_sleep: count(l => l.kind === 'sleep' && POOR_SLEEP.test(l.value ?? '')),
    low_mood: count(l => l.kind === 'mood' && LOW_MOODS.test(l.value ?? '')),
    top: Object.entries(other).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k)
  }
}

export function describeSymptoms(s) {
  const parts = [
    s.hot_flash && `hot flushes on ${s.hot_flash} days`, s.night_sweat && `night sweats on ${s.night_sweat} days`,
    s.poor_sleep && `poor sleep on ${s.poor_sleep} days`, s.low_mood && `low mood on ${s.low_mood} days`,
    s.top.length && `also: ${s.top.join(', ')}`
  ].filter(Boolean)
  return parts.length ? `In the last ${s.days} days she logged ${parts.join('; ')}.` : `Nothing logged in the last ${s.days} days.`
}

// Calcium, vitamin D and protein for strong bones, by diet.
const BONE_FOODS = {
  vegetarian: ['Ragi dosa or ragi malt', 'Curd, buttermilk or paneer', 'Til (sesame) chikki', 'Rajma, chana and soy chunks', 'Methi, drumstick (moringa) leaves', 'Amaranth (rajgira)'],
  eggetarian: ['Eggs (the yolk has vitamin D)', 'Ragi dosa or ragi malt', 'Curd or paneer', 'Til (sesame) chikki', 'Drumstick (moringa) leaves', 'Rajma, chana and soy'],
  nonveg: ['Small fish with bones (sardines, mathi)', 'Eggs', 'Ragi dosa or ragi malt', 'Curd or paneer', 'Til (sesame) chikki', 'Drumstick (moringa) leaves'],
  vegan: ['Ragi dosa or ragi malt', 'Tofu and soy chunks', 'Til (sesame) chikki or til chutney', 'Fortified soy milk', 'Drumstick (moringa) leaves', 'Amaranth (rajgira)'],
  jain: ['Ragi dosa or ragi malt', 'Curd, buttermilk or paneer', 'Til (sesame) chikki', 'Rajma, chana and moong', 'Methi leaves', 'Amaranth (rajgira)']
}
export function boneFoods(diet) {
  return BONE_FOODS[diet] ?? BONE_FOODS.vegetarian
}

// ---------- Sex drive across the cycle ----------
const DRIVE = { low: 1, normal: 2, high: 3 }
const DRIVE_PHASES = { menstrual: 'on your period', follicular: 'in the days after your period', ovulatory: 'around ovulation', luteal: 'in the week or two before your period' }

/**
 * How her sex drive moves with her cycle, from her own logs.
 * Needs at least 4 logs across 2+ phases; otherwise null.
 */
export function sexDrivePattern(profile, logs) {
  const starts = logs.filter(l => l.kind === 'period_start').map(l => l.log_date)
  const by = {}
  let n = 0
  for (const l of logs.filter(l => l.kind === 'sex_drive')) {
    const score = DRIVE[String(l.value ?? '').toLowerCase().trim()]
    if (!score) continue
    const c = computeCycle({ ...profile, life_stage: 'cycles', last_period_start: null }, starts.filter(s => s <= l.log_date), l.log_date)
    if (c.mode !== 'cycle' || !DRIVE_PHASES[c.phase]) continue
    ;(by[c.phase] ??= []).push(score)
    n++
  }
  const phases = Object.keys(by)
  if (n < 4 || phases.length < 2) return null
  const avg = Object.fromEntries(phases.map(p => [p, by[p].reduce((a, b) => a + b, 0) / by[p].length]))
  const sorted = [...phases].sort((a, b) => avg[b] - avg[a])
  const high = sorted[0], low = sorted.at(-1)
  if (avg[high] === avg[low]) return { count: n, avg, high: null, low: null, text: 'Your sex drive has been pretty steady across your cycle so far.' }
  return { count: n, avg, high, low, text: `Your sex drive tends to be highest ${DRIVE_PHASES[high]} and lowest ${DRIVE_PHASES[low]}.` }
}

// ---------- One paragraph for Hera's prompt ----------
export function describeStage(profile, cycle, logs, today) {
  const parts = []
  if (profile.life_stage === 'ttc') {
    const t = ttcInfo(profile, cycle, today)
    parts.push(`Trying to conceive${t.months !== null ? ` for about ${t.months} month${t.months === 1 ? '' : 's'}` : ''}.`)
    if (t.fertile) parts.push(`Estimated fertile window ${prettyDate(t.fertile.from)} to ${prettyDate(t.fertile.to)}.`)
    if (t.seeDoctor) parts.push(`It has been ${t.limit}+ months, so gently suggest seeing a fertility specialist (both partners can get checked).`)
    else if (t.earlyCheck) parts.push('With PCOS or irregular cycles, an early check-up with a gynaecologist helps, rather than waiting a year.')
  }
  if (profile.life_stage === 'pregnant' && cycle.pregnancy) {
    const g = pregnancyGuide(cycle.pregnancy)
    parts.push(`This week (${g.title}): ${g.focus} Baby is about the size of ${g.size}.`)
  }
  if (['perimenopause', 'postmenopause'].includes(profile.life_stage)) {
    parts.push(describeSymptoms(symptomSummary(logs, today)))
  }
  const sd = sexDrivePattern(profile, logs)
  if (sd) parts.push(`Sex drive pattern from her logs: ${sd.text.replace(/^Your/, 'Her').replace(/your /g, 'her ')}`)
  return parts.join(' ')
}

export function sourceList() {
  return Object.values(SOURCES).map(s => `- ${s.title}: ${s.url}`).join('\n')
}

// Safe dates for a due date she gives: from today up to about 10 months away.
export function validDueDate(d, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? '')) return false
  const diff = daysBetween(today, d)
  return diff >= -21 && diff <= 300
}

