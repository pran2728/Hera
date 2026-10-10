// Today's story cards: five quick, swipeable cards matched to her phase or life stage.
// Pure content, no network. General wellness guidance, pending gynaecologist review (Milestone 5).
import { daysBetween } from './cycle.js'
import { pregnancyGuide } from './stages.js'
import { lineBucket } from './quotes.js'

const BODY = {
  menstrual: ['What your body is doing', 'Oestrogen and progesterone are at their lowest, so your uterus sheds its lining. Low energy is your body asking for rest, not a personal failing.'],
  follicular: ['What your body is doing', 'Oestrogen is rising as an egg gets ready. Most women feel brighter, sharper and more social this week.'],
  ovulatory: ['What your body is doing', 'An egg is released. Oestrogen peaks and testosterone gets a small bump: hello confidence, and often a higher sex drive.'],
  luteal: ['What your body is doing', 'Progesterone takes over to prepare your uterus. It is calming, but it can also make you hungrier and a little slower.'],
  pms: ['What your body is doing', 'Both hormones drop in the days before your period. That drop is what brings PMS: bloating, cravings and lower moods. It passes.'],
  ttc_wait: ['What your body is doing', 'Progesterone is high after ovulation, which can cause sore breasts and tiredness whether or not you are pregnant. A test is most reliable from the day your period is due.'],
  menopause: ['What your body is doing', 'Oestrogen is lower now. That can affect sleep, body temperature, mood, joints and bones. Each of these can be eased, and none of them is "just ageing".'],
  general: ['Your body today', 'Even without clear phases, sleep, stress, food and movement shape how you feel. Noticing your patterns is the first step.']
}

// Foods with tags, so we can respect her diet: egg, meat, dairy, root (Jain), honey.
const PLATES = {
  menstrual: [['Palak dal with lemon', []], ['Rajma chawal', []], ['Dates and jaggery', []], ['Ginger tea', ['root']], ['Moong khichdi', []], ['Egg bhurji', ['egg']], ['Fish curry', ['meat']], ['Methi thepla', []]],
  follicular: [['Moong sprouts chaat', []], ['Curd rice', ['dairy']], ['Idli with sambar', []], ['Paneer tikka', ['dairy']], ['Tofu stir-fry', []], ['Millet upma', []], ['Boiled eggs', ['egg']], ['Grilled chicken', ['meat']]],
  ovulatory: [['Papaya bowl', []], ['Cabbage thoran', []], ['Fruit chaat', []], ['Mixed nuts and seeds', []], ['Quinoa salad', []], ['Sprouts salad', []], ['Fish tikka', ['meat']], ['Egg salad', ['egg']]],
  luteal: [['Ragi dosa', []], ['Sweet potato chaat', ['root']], ['Banana', []], ['Pumpkin seeds', []], ['Chana masala', []], ['Til laddoo', []], ['Dark chocolate square', []], ['Oats porridge', []]],
  pregnant: [['Dal and rice', []], ['Paneer bhurji', ['dairy']], ['Ragi porridge', []], ['Seasonal fruit', []], ['Spinach paratha', []], ['Well-cooked eggs', ['egg']], ['Til chikki', []], ['Curd', ['dairy']]],
  menopause: [['Ragi malt', []], ['Til chutney', []], ['Paneer or tofu', []], ['Rajma or chana', []], ['Drumstick leaves sabzi', []], ['Small fish with bones', ['meat']], ['Eggs', ['egg']], ['Soy chunks curry', []]]
}
const PLATE_WHY = {
  menstrual: 'Iron replaces what you lose, and vitamin C (lemon, amla) helps you absorb it.',
  follicular: 'Light, fresh protein and fibre for rising energy.',
  ovulatory: 'Fibre and colourful food for your most active days.',
  luteal: 'Complex carbs and magnesium help keep cravings and mood steady.',
  pregnant: 'Protein, iron and calcium at every meal. Your doctor\'s advice comes first.',
  menopause: 'Calcium, protein and vitamin D for strong bones.'
}
const BLOCKED = {
  vegan: ['egg', 'meat', 'dairy', 'honey'], jain: ['egg', 'meat', 'root'], vegetarian: ['egg', 'meat'],
  eggetarian: ['meat'], nonveg: []
}

export function plateFor(profile, bucket) {
  const key = { pms: 'luteal', ttc_wait: 'luteal', general: 'follicular' }[bucket] ?? bucket
  const blocked = BLOCKED[profile?.diet] ?? BLOCKED.vegetarian
  const avoid = String(profile?.allergies ?? '').toLowerCase().split(/[,;/]| and /).map(s => s.trim()).filter(w => w.length > 2)
  const foods = PLATES[key]
    .filter(([, tags]) => !tags.some(t => blocked.includes(t)))
    .filter(([name]) => !avoid.some(a => name.toLowerCase().includes(a)))
    .map(([name]) => name)
  return { foods: foods.slice(0, 5), why: PLATE_WHY[key] }
}

const MOVES = {
  menstrual: ['Gentle is the goal', '20 minutes of walking, child\'s pose and cat-cow stretches. Movement can actually ease cramps. Rest fully if your body says no.'],
  follicular: ['Try something new', 'Energy is climbing, so this is a great week for a dance class, a new route or a harder workout.'],
  ovulatory: ['Go for it', 'Your strongest days: strength training, a fast walk-run or a sport with friends.'],
  luteal: ['Steady does it', 'Moderate workouts like pilates, strength at a comfortable weight or a long walk. Keep intensity a notch lower.'],
  pms: ['Move to feel better', 'A brisk 20-minute walk or some yoga can lift mood and ease bloating. Even 10 minutes counts.'],
  ttc_wait: ['Keep it comfortable', 'Walking, yoga and swimming are all fine. No need to stop normal exercise while you wait.'],
  pregnant: ['Gentle and safe', 'Walking, prenatal yoga or swimming, if your doctor is happy with it. You should still be able to talk while you move.'],
  menopause: ['Build strong bones', 'Strength or weight-bearing exercise twice a week, like brisk walks, stairs or light weights, protects bones and mood.'],
  general: ['Move a little', 'A 15-minute walk after a meal is one of the simplest things you can do for energy and mood.']
}

const FACTS = [
  'Cycles anywhere from 21 to 35 days are normal. Yours does not have to be 28.',
  'Period cramps come from prostaglandins, chemicals that make the uterus contract. Painkillers that block them work best taken early.',
  'Ovulation does not always happen on day 14. It is usually about 14 days before your next period.',
  'Stress can delay ovulation, which pushes your period later.',
  'Tea and coffee with meals reduce how much iron you absorb. Have them an hour apart.',
  'Most people lose 2 to 3 tablespoons of blood in a whole period. It often looks like more.',
  'You can get pregnant from sex during your period, especially with short cycles. Predictions are never contraception.',
  'PCOS is one of the most common hormonal conditions in women, and it looks different in everyone.',
  'Sleep changes across your cycle: many women sleep worse in the days before their period.',
  'Exercise releases endorphins, which are natural painkillers. That is why a walk can ease cramps.'
]
const PREG_FACTS = [
  'Baby can hear sounds from around week 18. Talking and singing count as bonding.',
  'Iron needs almost double in pregnancy. Your doctor will usually prescribe tablets.',
  'Pregnancy brain is real: blood flow and sleep changes affect memory for a while.',
  'Heartburn is common later on because the growing uterus pushes up on the stomach.'
]
const MENO_FACTS = [
  'Perimenopause can start in the early 40s and last several years before periods stop.',
  'Menopause is confirmed after 12 months in a row without a period.',
  'A hot flush usually lasts a few minutes. Layers and cool water help.',
  'Women can lose bone faster in the years after menopause, which is why calcium and strength exercise matter.'
]

export function storiesFor(profile, cycle, today) {
  const bucket = lineBucket(profile, cycle)
  const day = Math.abs(daysBetween('2026-01-01', today))
  const cards = []

  // 1. Your body
  if (bucket === 'pregnant' && cycle?.pregnancy) {
    const g = pregnancyGuide(cycle.pregnancy)
    cards.push({ key: 'body', label: 'Your body', bg: 'plum', kicker: `Week ${cycle.pregnancy.week}`, title: `Baby is the size of ${g.size}`, body: g.focus })
  } else {
    const [title, body] = BODY[bucket === 'pregnant' ? 'general' : bucket] ?? BODY.general
    const kicker = cycle?.mode === 'cycle' && cycle.phase !== 'late'
      ? `Day ${cycle.day} · ${bucket === 'pms' ? 'PMS days' : bucket === 'ttc_wait' ? 'Two-week wait' : cycle.phase[0].toUpperCase() + cycle.phase.slice(1)}`
      : bucket === 'menopause' ? 'Menopause' : 'Today'
    cards.push({ key: 'body', label: 'Your body', bg: 'plum', kicker, title, body })
  }

  // 2. Today's plate
  const plate = plateFor(profile, bucket === 'general' && profile?.life_stage === 'pregnant' ? 'pregnant' : bucket)
  cards.push({ key: 'plate', label: 'Plate', bg: 'cream', kicker: "Today's plate", title: 'Eat this today', chips: plate.foods, body: plate.why })

  // 3. Move
  const [mt, mb] = MOVES[bucket] ?? MOVES.general
  cards.push({ key: 'move', label: 'Move', bg: 'blush', kicker: 'Move today', title: mt, body: mb })

  // 4. Did you know
  const facts = bucket === 'pregnant' ? PREG_FACTS : bucket === 'menopause' ? MENO_FACTS : FACTS
  cards.push({ key: 'fact', label: 'Did you know', bg: 'dark', kicker: 'Did you know?', title: facts[day % facts.length] })

  // 5. Check-in: tapping an answer logs it
  cards.push({
    key: 'checkin', label: 'Check-in', bg: 'plum', kicker: 'Quick check-in', title: "How's your energy today?",
    options: [['Low', 'energy', 'low'], ['Okay', 'energy', 'ok'], ['High', 'energy', 'high']]
  })
  return cards
}
