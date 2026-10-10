// Podcast picks: one every 3 days, matched to her phase or life stage.
// Every show here was checked to have a live official page (October 2026).
import { daysBetween } from './cycle.js'

export const PODCASTS = {
  on_being: { name: 'On Being', host: 'Krista Tippett', url: 'https://onbeing.org/series/podcast/' },
  feel_better: { name: 'Feel Better, Live More', host: 'Dr Rangan Chatterjee', url: 'https://drchatterjee.com/podcast/' },
  hidden_brain: { name: 'Hidden Brain', host: 'Shankar Vedantam', url: 'https://www.hiddenbrain.org/podcast/' },
  ted_daily: { name: 'TED Talks Daily', host: 'TED', url: 'https://www.ted.com/podcasts/ted-talks-daily' },
  happiness_lab: { name: 'The Happiness Lab', host: 'Dr Laurie Santos', url: 'https://www.happinesslab.fm/' },
  unlocking_us: { name: 'Unlocking Us', host: 'Brené Brown', url: 'https://brenebrown.com/podcast-show/unlocking-us/' },
  fertility_friday: { name: 'Fertility Friday', host: 'Lisa Hendrickson-Jack', url: 'https://fertilityfriday.com/' },
  birth_hour: { name: 'The Birth Hour', host: 'Bryn Huntpalmer', url: 'https://www.thebirthhour.com/' },
  pregnancy_podcast: { name: 'Pregnancy Podcast', host: 'Vanessa Merten', url: 'https://pregnancypodcast.com/' },
  birth_agni: { name: 'Birth Agni Podcast', host: 'BirthAgni (India)', url: 'https://www.birthagni.com/birthagnipodcast' },
  newson: { name: 'The Dr Louise Newson Podcast', host: 'Dr Louise Newson', url: 'https://www.drlouisenewson.co.uk/podcasts' }
}

// [show, why it fits right now]
const PICKS = {
  menstrual: [['on_being', 'slow, gentle conversations for low-energy days. Perfect with a hot water bag.'],
              ['feel_better', 'easy, practical health chats you can listen to lying down.']],
  follicular: [['hidden_brain', 'your energy and curiosity are rising, and this show is full of "huh, interesting!" moments.'],
               ['ted_daily', 'short, fresh ideas for the week you feel like starting new things.']],
  ovulatory: [['ted_daily', 'bold ideas for your most confident, social days.'],
              ['happiness_lab', 'the science of connection, for the days you feel most like being with people.']],
  luteal: [['happiness_lab', 'small, science-backed ways to keep your mood steady as energy slows.'],
           ['on_being', 'calm and grounding for the quieter half of your cycle.']],
  pms: [['unlocking_us', 'warm, honest talk about big feelings. Kind company for PMS days.'],
        ['happiness_lab', 'gentle mood boosts that actually have science behind them.']],
  ttc: [['fertility_friday', 'all about understanding your cycle and fertility signs.'],
        ['feel_better', 'sleep, stress and food habits that support your body while you try.']],
  pregnant: [['pregnancy_podcast', 'evidence-based answers for each stage of pregnancy.'],
             ['birth_agni', 'birth and postpartum, told from an Indian point of view.'],
             ['birth_hour', 'real birth stories from all kinds of women.']],
  menopause: [['newson', 'a menopause doctor explaining symptoms and treatment options clearly.'],
              ['feel_better', 'sleep, strength and stress tips that matter even more now.']],
  general: [['feel_better', 'practical, kind health advice in plain words.'],
            ['happiness_lab', 'small habits that make everyday life feel lighter.'],
            ['hidden_brain', 'curious stories about how our minds work.']]
}

export function podcastBucket(profile, cycle) {
  const stage = profile?.life_stage
  if (stage === 'pregnant') return 'pregnant'
  if (stage === 'perimenopause' || stage === 'postmenopause') return 'menopause'
  if (stage === 'ttc') return 'ttc'
  if (cycle?.mode !== 'cycle' || !cycle.phase || cycle.phase === 'late') return 'general'
  return cycle.lateLuteal ? 'pms' : cycle.phase
}

// Same pick for 3 days in a row, then the next one.
export function podcastFor(profile, cycle, today) {
  const bucket = podcastBucket(profile, cycle)
  const list = PICKS[bucket]
  const slot = Math.floor(Math.max(0, daysBetween('2026-01-01', today)) / 3)
  const [key, why] = list[slot % list.length]
  return { ...PODCASTS[key], why, bucket }
}

// A new pick starts every 3rd day.
export function isPodcastDay(today) {
  return Math.max(0, daysBetween('2026-01-01', today)) % 3 === 0
}
