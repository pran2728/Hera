import { useEffect, useRef, useState } from 'react'
import { supabase, withRetry, isNetworkError, diagnose } from '../lib/supabase'
import { extractName } from '../lib/name'
import { localToday } from '../lib/dates'
import { prettyDate } from '../lib/cycle'
import { Logo } from '../App.jsx'

const NO_PERIOD_STAGES = ['pregnant', 'postmenopause']

// Each step: what Hera asks, how she can answer, and where the answer is saved.
const STEPS = [
  {
    key: 'name',
    ask: () => "Hi, I'm Hera 💜 I'll be your cycle companion. What should I call you?",
    input: { type: 'text', placeholder: 'Your name' }
  },
  {
    key: 'adult',
    ask: a => `Lovely to meet you, ${a.name}! Quick check first: are you 18 or older?`,
    input: { type: 'chips', options: [['yes', "Yes, I'm 18+"], ['no', "No, I'm under 18"]] }
  },
  {
    key: 'life_stage',
    ask: () => 'Which of these fits you best right now?',
    input: {
      type: 'chips', options: [
        ['cycles', 'I get regular periods'],
        ['ttc', "I'm trying to conceive"],
        ['pregnant', "I'm pregnant"],
        ['perimenopause', 'Perimenopause (my periods are changing)'],
        ['postmenopause', 'Postmenopause (no period for 12+ months)']
      ]
    }
  },
  {
    key: 'last_period_start',
    skip: a => NO_PERIOD_STAGES.includes(a.life_stage),
    ask: () => 'When did your last period start? A rough date is totally fine.',
    input: { type: 'date', skipLabel: "I don't remember" }
  },
  {
    key: 'cycle_length',
    skip: a => NO_PERIOD_STAGES.includes(a.life_stage),
    ask: () => 'How many days is your cycle usually? Count from the first day of one period to the first day of the next.',
    input: { type: 'number', min: 15, max: 90, placeholder: 'e.g. 28', skipLabel: 'Not sure' }
  },
  {
    key: 'period_length',
    skip: a => NO_PERIOD_STAGES.includes(a.life_stage),
    ask: () => 'And how many days does your period usually last?',
    input: { type: 'number', min: 1, max: 15, placeholder: 'e.g. 5', skipLabel: 'Not sure' }
  },
  {
    key: 'contraception',
    skip: a => NO_PERIOD_STAGES.includes(a.life_stage),
    ask: () => 'Are you using any contraception? This changes how I read your cycle.',
    input: {
      type: 'chips', options: [
        ['none', 'None'],
        ['condoms', 'Condoms'],
        ['combined', 'Combined pill, patch or ring'],
        ['progestin_pill', 'Mini-pill'],
        ['hormonal_iud', 'Hormonal IUD'],
        ['implant', 'Implant or injection'],
        ['copper_iud', 'Copper IUD'],
        ['unsaid', 'Prefer not to say']
      ]
    }
  },
  {
    key: 'conditions',
    ask: () => 'Do any of these apply to you? Pick all that fit.',
    input: { type: 'multi', options: [['PCOS/PCOD', 'PCOS / PCOD'], ['Endometriosis', 'Endometriosis'], ['Thyroid', 'Thyroid'], ['none', 'None of these']] }
  },
  {
    key: 'diet',
    ask: () => "What do you eat? I'll suggest foods that fit.",
    input: {
      type: 'chips', options: [
        ['vegetarian', 'Vegetarian'], ['vegan', 'Vegan'], ['jain', 'Jain'],
        ['eggetarian', 'Eggetarian'], ['nonveg', 'Non-vegetarian']
      ]
    }
  },
  {
    key: 'allergies',
    ask: () => 'Any allergies or foods you avoid?',
    input: { type: 'text', placeholder: 'e.g. peanuts, mushrooms', skipLabel: 'None' }
  },
  {
    key: 'tone',
    ask: () => 'Last one about me: how should I talk to you?',
    input: {
      type: 'chips', options: [
        ['bestie', 'Like a bestie 💜 (babe, darling…)'],
        ['gentle', 'Gentle and calm'],
        ['facts', 'Just the facts']
      ]
    }
  },
  {
    key: 'consent',
    ask: () => [
      'Before we start, the important bit:',
      '• I save our chats and what you log so I can help you. Only you can see them.',
      "• I give guidance, not diagnosis. For anything worrying, please see a doctor.",
      "• While Hera is being tested, my replies come from Google's free AI, which may use chats to improve its products. Please use made-up test details for now, not your real health data."
    ].join('\n'),
    input: { type: 'chips', options: [['agree', 'I understand and agree 💜']] }
  }
]

function labelFor(step, value) {
  const { input } = step
  if (value === null || value === undefined || value === '') return input.skipLabel || 'Skip'
  if (input.type === 'chips') return input.options.find(o => o[0] === value)?.[1] ?? value
  if (input.type === 'multi') return value.map(v => input.options.find(o => o[0] === v)?.[1] ?? v).join(', ')
  if (input.type === 'date') return prettyDate(value)
  return String(value)
}

const draftKey = id => `hera-onboarding-${id}`

function loadDraft(id) {
  try { return JSON.parse(localStorage.getItem(draftKey(id))) || null } catch { return null }
}

export default function Onboarding({ session, onDone }) {
  const draft = loadDraft(session.user.id)
  const [answers, setAnswers] = useState(draft?.answers ?? {})
  const [index, setIndex] = useState(draft?.index ?? 0)
  const [transcript, setTranscript] = useState(draft?.transcript ?? [{ role: 'hera', text: STEPS[0].ask({}) }])
  const [blocked, setBlocked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const bottom = useRef(null)

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [transcript, index, error])

  // Keep progress if the app is closed or reloads mid-way.
  useEffect(() => {
    try { localStorage.setItem(draftKey(session.user.id), JSON.stringify({ answers, index, transcript })) } catch { /* private mode */ }
  }, [answers, index, transcript, session.user.id])

  const step = STEPS[index]

  function answer(value) {
    const shown = labelFor(step, value)
    if (step.key === 'name') value = extractName(value) || value.trim()
    const next = { ...answers, [step.key]: value }
    const lines = [...transcript, { role: 'me', text: shown }]

    if (step.key === 'adult' && value === 'no') {
      setTranscript([...lines, {
        role: 'hera',
        text: "Thank you for being honest 💜 Hera is only for adults right now. If you have questions about periods, a parent, a school nurse or a doctor is a great person to ask."
      }])
      setBlocked(true)
      return
    }

    let n = index + 1
    while (n < STEPS.length && STEPS[n].skip?.(next)) n++
    setAnswers(next)
    if (n >= STEPS.length) {
      setTranscript(lines)
      finish(next)
    } else {
      setTranscript([...lines, { role: 'hera', text: STEPS[n].ask(next) }])
      setIndex(n)
    }
  }

  async function finish(a) {
    setSaving(true); setError('')
    const now = new Date().toISOString()
    const profile = {
      id: session.user.id,
      name: a.name?.trim() || null,
      life_stage: a.life_stage,
      last_period_start: a.last_period_start || null,
      cycle_length: a.cycle_length ? Number(a.cycle_length) : 28,
      cycle_length_known: Boolean(a.cycle_length),
      period_length: a.period_length ? Number(a.period_length) : 5,
      contraception: a.contraception || null,
      conditions: (a.conditions || []).filter(c => c !== 'none'),
      diet: a.diet,
      allergies: a.allergies?.trim() || null,
      tone: a.tone || 'bestie',
      consent_at: now,
      onboarded_at: now
    }
    const { data, error } = await withRetry(() => supabase.from('profiles').upsert(profile).select().single())
    if (error) {
      setSaving(false)
      setError(isNetworkError(error)
        ? `I couldn't reach my memory to save this. Check your internet and tap "I understand and agree" again.\n\n${await diagnose()}`
        : `Couldn't save: ${error.message}`)
      return
    }
    if (profile.last_period_start) {
      await withRetry(() => supabase.from('cycle_logs')
        .insert({ user_id: session.user.id, log_date: profile.last_period_start, kind: 'period_start' }))
    }
    try { localStorage.removeItem(draftKey(session.user.id)) } catch { /* private mode */ }
    onDone(data)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand"><Logo size={32} /><span>Hera</span></div>
        <span className="progress">{Math.min(index + 1, STEPS.length)} / {STEPS.length}</span>
      </header>

      <main className="chat">
        {transcript.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>{m.text}</div>
        ))}
        {saving && <div className="bubble hera typing"><span /><span /><span /></div>}
        {error && <div className="bubble hera failed" role="alert">{error}</div>}
        <div ref={bottom} />
      </main>

      {blocked
        ? <div className="composer"><button className="primary wide" onClick={() => supabase.auth.signOut()}>Sign out</button></div>
        : !saving && <AnswerBox key={step.key} step={step} onAnswer={answer} />}
    </div>
  )
}

function AnswerBox({ step, onAnswer }) {
  const { input } = step
  const [value, setValue] = useState('')
  const [picked, setPicked] = useState([])

  if (input.type === 'chips') {
    return (
      <div className="answers">
        {input.options.map(([v, label]) => (
          <button key={v} className="chip" onClick={() => onAnswer(v)}>{label}</button>
        ))}
      </div>
    )
  }

  if (input.type === 'multi') {
    const toggle = v => setPicked(p =>
      v === 'none' ? ['none'] : p.includes(v) ? p.filter(x => x !== v) : [...p.filter(x => x !== 'none'), v])
    return (
      <div className="answers">
        {input.options.map(([v, label]) => (
          <button key={v} className={`chip ${picked.includes(v) ? 'on' : ''}`} aria-pressed={picked.includes(v)}
                  onClick={() => toggle(v)}>{label}</button>
        ))}
        <button className="primary" disabled={!picked.length} onClick={() => onAnswer(picked)}>Done</button>
      </div>
    )
  }

  const today = localToday()
  const valid = input.type === 'number'
    ? value !== '' && Number(value) >= input.min && Number(value) <= input.max
    : input.type === 'date' ? value && value <= today : value.trim().length > 0

  return (
    <form className="composer column" onSubmit={e => { e.preventDefault(); if (valid) onAnswer(value) }}>
      {input.skipLabel && (
        <button type="button" className="chip small" onClick={() => onAnswer(null)}>{input.skipLabel}</button>
      )}
      <div className="row">
        <input
          autoFocus
          type={input.type === 'number' ? 'number' : input.type === 'date' ? 'date' : 'text'}
          inputMode={input.type === 'number' ? 'numeric' : undefined}
          min={input.type === 'number' ? input.min : undefined}
          max={input.type === 'number' ? input.max : input.type === 'date' ? today : undefined}
          placeholder={input.placeholder}
          value={value}
          onChange={e => setValue(e.target.value)}
          aria-label={step.ask({}).slice(0, 60)}
        />
        <button className="primary" disabled={!valid}>Next</button>
      </div>
    </form>
  )
}
