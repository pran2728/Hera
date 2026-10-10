// Ready-made replies for simple small talk ("hi", "thank you", "bye").
// These never need the AI, so Hera answers them instantly and uses no AI quota.
// Anything longer or less certain returns null and goes to the AI as usual.
import { isBirthday } from './stages.js'

const GREETINGS = new Set(['hi', 'hey', 'hello', 'helo', 'hlo', 'hii', 'heya', 'hiya', 'yo', 'namaste', 'namaskaram', 'hai',
  'good morning', 'gm', 'morning', 'good afternoon', 'good evening', 'hey there', 'hi there', 'hello there', 'whats up', 'sup', 'wassup'])
const THANKS = new Set(['thanks', 'thank you', 'thank u', 'thanku', 'thankyou', 'thx', 'ty', 'tysm', 'thanks a lot',
  'thank you so much', 'thanks so much', 'thanks a ton', 'dhanyavad', 'dhanyavaad', 'shukriya', 'thanks love', 'thank you love'])
const BYES = new Set(['bye', 'byee', 'bye bye', 'good night', 'gn', 'goodnight', 'night', 'see you', 'see ya', 'ttyl', 'talk later', 'cya'])

// "Heyyy Hera!! 💜" → "hey"
export function normalise(message) {
  return String(message ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\s]/gu, ' ')            // drop emojis, punctuation and digits
    .replace(/\b(hera|babe|dear|ji|girl|bestie)\b/g, ' ')
    .replace(/(\p{L})\1{2,}/gu, '$1$1')      // "heyyyy" → "heyy"
    .replace(/\s+/g, ' ')
    .trim()
}

export function smallTalkKind(message) {
  if (String(message ?? '').length > 40) return null
  const n = normalise(message)
  if (!n) return null
  const variants = [n, n.replace(/(\p{L})\1/gu, '$1')] // "hii" and "hi", "byee" and "bye"
  if (variants.some(v => GREETINGS.has(v))) return 'greeting'
  if (variants.some(v => THANKS.has(v))) return 'thanks'
  if (variants.some(v => BYES.has(v))) return 'bye'
  return null
}

const TALK_PHASES = {
  menstrual: 'on your period', follicular: 'in your follicular phase', ovulatory: 'in your ovulatory phase', luteal: 'in your luteal phase'
}

function whereYouAre(cycle) {
  if (!cycle) return ''
  if (cycle.mode === 'pregnant' && cycle.pregnancy) return `week ${cycle.pregnancy.week} of your pregnancy`
  if (cycle.mode === 'cycle' && cycle.phase === 'late') return 'a few days past your expected period'
  if (cycle.mode === 'cycle' && TALK_PHASES[cycle.phase]) {
    return `day ${cycle.day}, ${cycle.lateLuteal ? 'in your PMS days' : TALK_PHASES[cycle.phase]}`
  }
  return ''
}

const pickLine = (list, seed) => list[Math.abs(seed) % list.length]

/**
 * @returns the reply text, or null when the AI should answer.
 */
export function quickReply(message, profile = {}, cycle, today = '') {
  const kind = smallTalkKind(message)
  if (!kind) return null
  const tone = profile.tone || 'bestie'
  const name = profile.name ? ` ${profile.name}` : ''
  const seed = Number(today.replace(/-/g, '')) + String(message).length
  const where = whereYouAre(cycle)
  const birthday = isBirthday(profile.birth_date, today)

  if (kind === 'greeting') {
    if (birthday) {
      return tone === 'facts'
        ? `Happy birthday${name}. How are you feeling today?`
        : `Happy birthday${name}! 🎂💜 I hope today is full of good food and people who love you. How are you feeling?`
    }
    const day = where ? ` You're ${where}.` : ''
    if (tone === 'facts') return `Hi${name}.${day} How are you feeling today? You can tell me symptoms, mood or questions.`
    if (tone === 'gentle') return `Hello${name}, it's good to hear from you.${day} How are you feeling today?`
    return pickLine([
      `Heyyy${name}! 💜${day} How are you feeling today?`,
      `Hi${name}! So good to see you 💜${day} What's on your mind?`,
      `Hey hey${name}!${day} Tell me everything: how's your body and mood today?`
    ], seed)
  }

  if (kind === 'thanks') {
    if (tone === 'facts') return "You're welcome. Message me any time."
    if (tone === 'gentle') return "You're very welcome. I'm here whenever you need me."
    return pickLine([
      "Anytime, babe 💜 I'm always here.",
      "Aw, of course! That's what I'm here for 💜",
      "You're so welcome! Ping me whenever 💜"
    ], seed)
  }

  // bye
  if (tone === 'facts') return 'Bye for now. Message me any time.'
  if (tone === 'gentle') return 'Take care of yourself. I am here whenever you want to talk.'
  return pickLine([
    'Bye babe! Drink some water and be kind to yourself 💜',
    "Talk soon! I'm here whenever you need me 💜",
    'Take care, love. Sleep well when it\'s time 💜'
  ], seed)
}
