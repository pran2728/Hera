// One-tap logging from the Today screen. Saves straight to her logs (same rules as chat logging).
import { supabase } from './supabase'
import { addDays } from './cycle'

const MOODS = [
  { id: 'happy', label: 'Happy', kind: 'mood', value: 'happy' },
  { id: 'low', label: 'Low', kind: 'mood', value: 'low' },
  { id: 'anxious', label: 'Anxious', kind: 'mood', value: 'anxious' }
]
const CRAMPS = { id: 'cramps', label: 'Cramps', kind: 'pain', pick: [['Mild', '3'], ['Bad', '6'], ['Severe', '8']], show: v => `${v}/10` }
const DRIVE = { id: 'drive', label: 'Sex drive', kind: 'sex_drive', pick: [['Low', 'low'], ['Normal', 'normal'], ['High', 'high']] }

export function quickItems(profile, cycle) {
  const stage = profile?.life_stage
  const onPeriod = cycle?.mode === 'cycle' && cycle.phase === 'menstrual'
  const period = onPeriod
    ? { id: 'pend', label: 'Period ended', kind: 'period_end' }
    : { id: 'pstart', label: 'Period started', kind: 'period_start' }
  if (stage === 'pregnant') {
    return [
      { id: 'nausea', label: 'Nausea', kind: 'symptom', value: 'nausea' },
      { id: 'tired', label: 'Tired', kind: 'energy', value: 'low' },
      { id: 'back', label: 'Back pain', kind: 'symptom', value: 'back pain' },
      { id: 'heartburn', label: 'Heartburn', kind: 'symptom', value: 'heartburn' },
      { id: 'kicks', label: 'Felt baby move', kind: 'note', value: 'felt baby move' },
      ...MOODS
    ]
  }
  const meno = [
    { id: 'flush', label: 'Hot flush', kind: 'hot_flash' },
    { id: 'sweat', label: 'Night sweats', kind: 'night_sweat' },
    { id: 'sleep', label: 'Slept badly', kind: 'sleep', value: 'poor sleep' },
    { id: 'joints', label: 'Joint pain', kind: 'symptom', value: 'joint pain' }
  ]
  if (stage === 'postmenopause') return [...meno, { id: 'tired', label: 'Tired', kind: 'energy', value: 'low' }, ...MOODS]
  if (stage === 'perimenopause') return [period, ...meno, CRAMPS, ...MOODS]
  return [
    period, CRAMPS,
    { id: 'bloat', label: 'Bloating', kind: 'symptom', value: 'bloating' },
    { id: 'head', label: 'Headache', kind: 'symptom', value: 'headache' },
    { id: 'acne', label: 'Acne', kind: 'symptom', value: 'acne' },
    { id: 'tired', label: 'Tired', kind: 'energy', value: 'low' },
    { id: 'energy', label: 'Energised', kind: 'energy', value: 'high' },
    ...MOODS, DRIVE
  ]
}

const NAMES = {
  period_start: 'Period started', period_end: 'Period ended', pain: 'Cramps', mood: 'Mood', energy: 'Energy',
  symptom: '', sleep: 'Sleep', sex_drive: 'Sex drive', note: '', hot_flash: 'Hot flush', night_sweat: 'Night sweats', flow: 'Flow'
}
export function logLabel(l) {
  const name = NAMES[l.kind] ?? l.kind
  if (!l.value) return name
  if (!name) return l.value[0].toUpperCase() + l.value.slice(1)
  return l.kind === 'pain' ? `${name} ${l.value}/10` : `${name}: ${l.value}`
}

export async function quickLog(userId, profile, kind, value, today) {
  if (kind === 'period_start' || kind === 'period_end') {
    // One start (or end) per period: replace one logged within 10 days.
    await supabase.from('cycle_logs').delete().eq('kind', kind)
      .gte('log_date', addDays(today, -10)).lte('log_date', addDays(today, 10))
  }
  const { data, error } = await supabase.from('cycle_logs')
    .insert({ log_date: today, kind, value: value ?? null }).select().single()
  if (error) throw error
  let profileUpdate = null
  if (kind === 'period_start') {
    const { data: p } = await supabase.from('profiles').update({ last_period_start: today }).eq('id', userId).select().single()
    profileUpdate = p
  }
  return { log: data, profile: profileUpdate }
}

export async function undoLog(log, profile, userId, logs) {
  await supabase.from('cycle_logs').delete().eq('id', log.id)
  if (log.kind === 'period_start' && profile.last_period_start === log.log_date) {
    const prev = logs.find(l => l.kind === 'period_start' && l.id !== log.id)?.log_date ?? null
    const { data } = await supabase.from('profiles').update({ last_period_start: prev }).eq('id', userId).select().single()
    return data
  }
  return null
}
