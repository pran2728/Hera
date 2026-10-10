// Today's line: one witty or encouraging thought a day, matched to her phase or life stage.
// All written for Hera (no borrowed quotes, so nothing is ever misattributed).
import { daysBetween } from './cycle.js'

const LINES = {
  menstrual: [
    "Rest isn't a reward you earn. It's part of the plan this week.",
    'Your body is doing its monthly reset. Snacks are basically maintenance fees.',
    'Low battery mode is still a mode. Go gentle.',
    'Cancel one thing today. The world will survive, and so will you.',
    'Hot water bag, warm khichdi, zero guilt. That is the whole agenda.',
    'Strong women lie on the sofa sometimes too.'
  ],
  follicular: [
    'Fresh energy, fresh page. Start the thing.',
    'Your hormones are basically cheering for you this week.',
    "That idea you keep postponing? This is its week.",
    'Spring is happening inside you. Plant something: a habit, a plan, a tulsi pot.',
    'Say yes to one new thing today.',
    'Momentum likes you right now. Use it.'
  ],
  ovulatory: [
    'Main character energy: fully charged.',
    'Book the meeting. Wear the outfit. Send the text.',
    "You're at your most magnetic. Spend it on people who deserve it.",
    'Peak days are for big asks.',
    'Your confidence is up, so let your voice be too.',
    "That glow isn't a filter. It's hormones."
  ],
  luteal: [
    'Slowing down is not falling behind.',
    'Finish things instead of starting them. Closure feels great right now.',
    "Your to-do list can be shorter. You're still doing enough.",
    'Cosy is a valid productivity strategy.',
    'Protect your evenings this week.',
    'Luteal brain is honest, just a little loud. Listen, then decide.'
  ],
  pms: [
    "If everything feels like too much, that might be your hormones talking. Hear them; you don't have to obey them.",
    'Not every thought you have this week deserves a reply.',
    'Chocolate is not the enemy. Neither are you.',
    'Feelings are bigger right now. They are also temporary.',
    "Be the friend to yourself that you'd be to anyone else on day 26.",
    'A nap is a perfectly good answer to most problems today.'
  ],
  ttc_wait: [
    'The two-week wait is long. Fill it with things that are not Google.',
    'Whatever this month brings, you are already doing this with so much love.',
    'Your worth is not measured in cycles.',
    'Hope and worry can sit together. Make room for a little fun too.'
  ],
  pregnant: [
    "You're growing a whole person. Everything else can wait a little.",
    "Tired isn't lazy. It's construction work.",
    'Eat the snack. Take the nap. Ask for help.',
    'Every week is a milestone, even the boring ones.',
    'Your body knows this job. Your doctor is your co-pilot.',
    "You don't have to love every day of this to love where it's going."
  ],
  menopause: [
    'New chapter, same you, stronger opinions.',
    'Hot flush? Call it a personal summer.',
    'Strong bones, strong boundaries.',
    'Nobody does wisdom like a woman who has lived through every season.',
    'Slept badly? Then be twice as gentle with yourself today.',
    'This is a transition, not an ending.'
  ],
  general: [
    "Check in with yourself today. You're worth the five minutes.",
    'Water, a walk, a kind word to yourself. Start there.',
    "You don't need it all figured out to have a good day.",
    'Notice one thing your body did well today.',
    'Small and steady still counts.'
  ]
}

export function lineBucket(profile, cycle) {
  const stage = profile?.life_stage
  if (stage === 'pregnant') return 'pregnant'
  if (stage === 'perimenopause' || stage === 'postmenopause') return 'menopause'
  if (cycle?.mode !== 'cycle' || !cycle.phase || cycle.phase === 'late') return 'general'
  if (stage === 'ttc' && cycle.phase === 'luteal') return 'ttc_wait'
  return cycle.lateLuteal ? 'pms' : cycle.phase
}

export function lineFor(profile, cycle, today) {
  const list = LINES[lineBucket(profile, cycle)]
  return list[Math.abs(daysBetween('2026-01-01', today)) % list.length]
}

export { LINES }
