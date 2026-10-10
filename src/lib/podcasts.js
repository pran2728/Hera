// Podcast picks: one every 3 days, matched to her phase or life stage.
// Every talk and episode here was checked to have a live page that plays it (October 2026).
import { daysBetween } from './cycle.js'

// Each pick is ONE specific talk or episode (not a show's home page), so "Listen" plays it straight away.
// name = the episode or talk title, host = who's speaking, show = where it's from.
export const PODCASTS = {
  gunter_periods: { name: "Why can't we talk about periods?", host: 'Dr Jen Gunter', show: 'TED Talk', url: 'https://www.ted.com/talks/jen_gunter_why_can_t_we_talk_about_periods' },
  walker_sleep: { name: 'Sleep is your superpower', host: 'Matt Walker', show: 'TED Talk', url: 'https://www.ted.com/talks/matt_walker_sleep_is_your_superpower' },
  urban_procrastinator: { name: 'Inside the mind of a master procrastinator', host: 'Tim Urban', show: 'TED Talk', url: 'https://www.ted.com/talks/tim_urban_inside_the_mind_of_a_master_procrastinator' },
  gilbert_genius: { name: 'Your elusive creative genius', host: 'Elizabeth Gilbert', show: 'TED Talk', url: 'https://www.ted.com/talks/elizabeth_gilbert_your_elusive_creative_genius' },
  waldinger_good_life: { name: 'What makes a good life? Lessons from the longest study on happiness', host: 'Robert Waldinger', show: 'TED Talk', url: 'https://www.ted.com/talks/robert_waldinger_what_makes_a_good_life_lessons_from_the_longest_study_on_happiness' },
  brown_vulnerability: { name: 'The power of vulnerability', host: 'Brené Brown', show: 'TED Talk', url: 'https://www.ted.com/talks/brene_brown_the_power_of_vulnerability' },
  suzuki_exercise: { name: 'The brain-changing benefits of exercise', host: 'Wendy Suzuki', show: 'TED Talk', url: 'https://www.ted.com/talks/wendy_suzuki_the_brain_changing_benefits_of_exercise' },
  david_emotions: { name: 'The gift and power of emotional courage', host: 'Susan David', show: 'TED Talk', url: 'https://www.ted.com/talks/susan_david_the_gift_and_power_of_emotional_courage' },
  brown_heart_open: { name: 'Places we go when the heart is open', host: 'Brené Brown', show: 'Unlocking Us podcast', url: 'https://brenebrown.com/podcast/places-we-go-when-the-heart-is-open-from-atlas-of-the-heart' },
  schulze_pregnant: { name: 'What happens when you try to become pregnant?', host: 'Sally Schulze', show: 'TEDx Talk', url: 'https://www.ted.com/talks/sally_schulze_what_happens_when_you_try_to_become_pregnant' },
  paul_before_born: { name: "What we learn before we're born", host: 'Annie Murphy Paul', show: 'TED Talk', url: 'https://www.ted.com/talks/annie_murphy_paul_what_we_learn_before_we_re_born' },
  birth_agni_pain: { name: 'Natural pain relief: what traditional birth classes don\'t teach you', host: 'Divya Kapoor', show: 'Birth Agni podcast (India), episode 134', url: 'https://birthagni.buzzsprout.com/785771/episodes/17622869-134-natural-pain-relief-what-they-do-not-teach-you-in-traditional-birth-classes-the-embedded-gift' },
  newson_symptoms: { name: 'Symptoms and effective treatment for women experiencing the menopause', host: 'Dr Louise Newson and Dr Sarah Ball', show: 'The Dr Louise Newson Podcast', url: 'https://www.drlouisenewson.co.uk/podcasts/symptoms-and-effective-treatment-for-women-experiencing-the-menopause---dr-sarah-ball-and-dr-louise-newson' },
  gunter_menopause: { name: 'The menopause manifesto', host: 'Dr Jen Gunter', show: 'TED Talk', url: 'https://www.ted.com/talks/jen_gunter_the_menopause_manifesto' },
  mosconi_brain: { name: 'How menopause affects the brain', host: 'Dr Lisa Mosconi', show: 'TED Talk', url: 'https://www.ted.com/talks/lisa_mosconi_how_menopause_affects_the_brain' }
}

// [talk or episode, why it fits right now]
const PICKS = {
  menstrual: [['gunter_periods', 'a gynaecologist on what actually happens during your period. Perfect with a hot water bag.'],
              ['walker_sleep', 'why extra rest on low-energy days is doing real work for your body.']],
  follicular: [['urban_procrastinator', 'funny and useful for the week you feel like starting new things.'],
               ['gilbert_genius', 'a warm talk on creativity for your rising-energy days.']],
  ovulatory: [['waldinger_good_life', 'what decades of research say about relationships, for your most social days.'],
              ['brown_vulnerability', 'on courage and connection, for the days you feel most like being with people.']],
  luteal: [['suzuki_exercise', 'how movement lifts mood and focus as your energy slows.'],
           ['walker_sleep', 'sleep gets lighter before your period. This explains why it matters so much.']],
  pms: [['david_emotions', 'kind, practical ways to handle big feelings on PMS days.'],
        ['brown_heart_open', 'warm, honest talk about emotions. Kind company for PMS days.']],
  ttc: [['schulze_pregnant', 'clear facts about how conception really works.'],
        ['walker_sleep', 'rest and sleep matter while you try. A good reminder to look after yourself.']],
  pregnant: [['paul_before_born', 'a fascinating look at how your baby is already learning from you.'],
             ['birth_agni_pain', 'birth preparation from an Indian point of view.']],
  menopause: [['newson_symptoms', 'two menopause doctors explaining symptoms and treatment options clearly.'],
              ['gunter_menopause', 'a gynaecologist busting myths about menopause.'],
              ['mosconi_brain', 'why brain fog and mood changes happen, and what helps.']],
  general: [['waldinger_good_life', 'what decades of research say makes a good life.'],
            ['walker_sleep', 'the simplest health upgrade there is.'],
            ['suzuki_exercise', 'how even a little movement changes your mood and brain.']]
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
