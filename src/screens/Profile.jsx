import { useState } from 'react'
import { supabase, withRetry } from '../lib/supabase'
import { LIFE_STAGES, CONTRACEPTION, CONDITIONS, DIETS, TONES, ACTIVITY, GOALS } from '../lib/options'
import { NotificationsSwitch, ReminderSettings, PauseButton } from './Reminders.jsx'

const NO_PERIOD_STAGES = ['pregnant', 'postmenopause']

function fromProfile(p) {
  return {
    name: p.name ?? '',
    age: p.age ?? '',
    favourite_foods: p.favourite_foods ?? '',
    about_me: p.about_me ?? '',
    life_stage: p.life_stage ?? 'cycles',
    cycle_length: p.cycle_length_known ? String(p.cycle_length ?? '') : '',
    period_length: p.period_length ?? 5,
    contraception: p.contraception ?? 'none',
    conditions: p.conditions ?? [],
    diet: p.diet ?? 'vegetarian',
    allergies: p.allergies ?? '',
    activity_level: p.activity_level ?? '',
    goals: p.goals ?? [],
    tone: p.tone ?? 'bestie',
    nudge_time: p.nudge_time ?? '09:00',
    checkin_day: p.checkin_day ?? 0,
    daily_tips: p.daily_tips ?? false,
    quiet_start: p.quiet_start ?? '22:00',
    quiet_end: p.quiet_end ?? '08:00',
    trusted_name: p.trusted_name ?? '',
    trusted_phone: p.trusted_phone ?? ''
  }
}

// Digits only, with India's 91 added to a 10-digit number (for WhatsApp links).
export function normalisePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '').replace(/^0+/, '')
  return d.length === 10 ? `91${d}` : d
}

export default function Profile({ session, profile, onSaved, onDeleted, onBack }) {
  const [f, setF] = useState(() => fromProfile(profile))
  const [status, setStatus] = useState('') // '', 'saving', 'saved'
  const [error, setError] = useState('')
  const set = (k, v) => { setF(x => ({ ...x, [k]: v })); setStatus('') }
  const toggle = (k, v) => set(k, f[k].includes(v) ? f[k].filter(x => x !== v) : [...f[k], v])

  const age = f.age === '' ? null : Number(f.age)
  const cycleLen = f.cycle_length === '' ? null : Number(f.cycle_length)
  const problems = [
    !f.name.trim() && 'Add a name for Hera to call you.',
    age !== null && (age < 18 || age > 120) && 'Age must be between 18 and 120.',
    cycleLen !== null && (cycleLen < 15 || cycleLen > 90) && 'Cycle length must be between 15 and 90 days.',
    (Number(f.period_length) < 1 || Number(f.period_length) > 15) && 'Period length must be between 1 and 15 days.',
    f.trusted_phone.trim() && !/^\d{10,15}$/.test(normalisePhone(f.trusted_phone)) && 'That phone number looks incomplete.'
  ].filter(Boolean)

  async function save(e) {
    e.preventDefault()
    if (problems.length) return
    setStatus('saving'); setError('')
    const update = {
      name: f.name.trim(),
      age,
      favourite_foods: f.favourite_foods.trim() || null,
      about_me: f.about_me.trim() || null,
      life_stage: f.life_stage,
      cycle_length: cycleLen ?? 28,
      cycle_length_known: cycleLen !== null,
      period_length: Number(f.period_length) || 5,
      contraception: f.contraception,
      conditions: f.conditions,
      diet: f.diet,
      allergies: f.allergies.trim() || null,
      activity_level: f.activity_level || null,
      goals: f.goals,
      tone: f.tone,
      nudge_time: f.nudge_time || '09:00',
      checkin_day: f.checkin_day,
      daily_tips: f.daily_tips,
      quiet_start: f.quiet_start || '22:00',
      quiet_end: f.quiet_end || '08:00',
      trusted_name: f.trusted_name.trim() || null,
      trusted_phone: f.trusted_phone.trim() ? normalisePhone(f.trusted_phone) : null
    }
    const { data, error } = await withRetry(() =>
      supabase.from('profiles').update(update).eq('id', session.user.id).select().single())
    if (error) {
      setStatus('')
      setError(/column/i.test(error.message)
        ? "Hera's database needs a quick update: run backend/database.sql in Supabase again, then try saving."
        : error.message)
      return
    }
    setStatus('saved')
    onSaved(data)
  }

  async function deleteEverything() {
    if (!confirm('Delete all your chats, logs and profile from Hera? This cannot be undone.')) return
    if (!confirm('Are you sure? Everything Hera knows about you will be erased.')) return
    const id = session.user.id
    for (const table of ['messages', 'cycle_logs']) {
      const { error } = await supabase.from(table).delete().eq('user_id', id)
      if (error) { setError(error.message); return }
    }
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) { setError(error.message); return }
    try { localStorage.removeItem(`hera-onboarding-${id}`) } catch { /* private mode */ }
    onDeleted()
  }

  const periods = !NO_PERIOD_STAGES.includes(f.life_stage)

  return (
    <div className="app">
      <header className="topbar">
        <button className="link" onClick={onBack} aria-label="Back to chat">← Chat</button>
        <span className="topbar-title">My profile</span>
        <span style={{ width: 64 }} />
      </header>

      <form className="cycle-page profile" onSubmit={save}>
        <section className="card">
          <h2>About you</h2>
          <Field label="What Hera calls you">
            <input value={f.name} onChange={e => set('name', e.target.value)} maxLength={40} autoComplete="given-name" />
          </Field>
          <Field label="Age" hint="Helps with age-specific advice, like fertility after 35 or perimenopause in your 40s.">
            <input type="number" inputMode="numeric" min={18} max={120} value={f.age}
                   onChange={e => set('age', e.target.value)} placeholder="e.g. 27" />
          </Field>
          <Field label="Favourite foods" hint="Hera will suggest these when they suit your phase and diet.">
            <input value={f.favourite_foods} onChange={e => set('favourite_foods', e.target.value)}
                   placeholder="e.g. dosa, rajma chawal, dark chocolate" maxLength={200} />
          </Field>
          <Field label="Anything Hera should know about you">
            <textarea rows={3} value={f.about_me} onChange={e => set('about_me', e.target.value)} maxLength={500}
                      placeholder="e.g. I work night shifts; I get migraines before my period" />
          </Field>
        </section>

        <section className="card">
          <h2>Your cycle</h2>
          <Field label="Life stage">
            <Select value={f.life_stage} onChange={v => set('life_stage', v)} options={LIFE_STAGES} />
          </Field>
          {periods && (
            <>
              <div className="two">
                <Field label="Usual cycle (days)" hint="Leave empty if not sure.">
                  <input type="number" inputMode="numeric" min={15} max={90} value={f.cycle_length}
                         onChange={e => set('cycle_length', e.target.value)} placeholder="Not sure" />
                </Field>
                <Field label="Period lasts (days)">
                  <input type="number" inputMode="numeric" min={1} max={15} value={f.period_length}
                         onChange={e => set('period_length', e.target.value)} />
                </Field>
              </div>
              <Field label="Contraception">
                <Select value={f.contraception} onChange={v => set('contraception', v)} options={CONTRACEPTION} />
              </Field>
            </>
          )}
          <Field label="Conditions" group>
            <Chips options={CONDITIONS} picked={f.conditions} onToggle={v => toggle('conditions', v)} />
          </Field>
        </section>

        <section className="card">
          <h2>Food and lifestyle</h2>
          <Field label="Diet">
            <Select value={f.diet} onChange={v => set('diet', v)} options={DIETS} />
          </Field>
          <Field label="Allergies or foods you avoid">
            <input value={f.allergies} onChange={e => set('allergies', e.target.value)} placeholder="e.g. peanuts, mushrooms" maxLength={200} />
          </Field>
          <Field label="How active are you?">
            <Select value={f.activity_level} onChange={v => set('activity_level', v)}
                    options={[['', 'Choose one'], ...ACTIVITY]} />
          </Field>
          <Field label="What do you want help with?" group>
            <Chips options={GOALS.map(g => [g, g])} picked={f.goals} onToggle={v => toggle('goals', v)} />
          </Field>
        </section>

        <section className="card">
          <h2>Reminders</h2>
          <NotificationsSwitch userId={session.user.id} />
          <ReminderSettings f={f} set={set} />
          <PauseButton userId={session.user.id} profile={profile} onSaved={onSaved} />
        </section>

        <section className="card">
          <h2>Your person</h2>
          <p className="muted small">Someone you trust. If you ever tell Hera you're not okay, she'll show a button to message them right away.</p>
          <div className="two">
            <Field label="Name">
              <input value={f.trusted_name} onChange={e => set('trusted_name', e.target.value)} placeholder="e.g. Rahul" maxLength={40} />
            </Field>
            <Field label="Phone (WhatsApp)">
              <input type="tel" inputMode="tel" value={f.trusted_phone} onChange={e => set('trusted_phone', e.target.value)} placeholder="98xxxxxxxx" maxLength={16} />
            </Field>
          </div>
        </section>

        <section className="card">
          <h2>How Hera talks to you</h2>
          <Chips options={TONES} picked={[f.tone]} onToggle={v => set('tone', v)} single />
        </section>

        {problems.length > 0 && <p className="error" role="alert">{problems[0]}</p>}
        {error && <p className="error" role="alert">{error}</p>}

        <div className="save-bar">
          <button className="primary wide" disabled={status === 'saving' || problems.length > 0}>
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved ✓' : 'Save'}
          </button>
        </div>

        <section className="card">
          <h2>Account</h2>
          <p className="muted small">Signed in as {session.user.email}</p>
          <button type="button" className="link left" onClick={() => supabase.auth.signOut()}>Sign out</button>
          <button type="button" className="link left danger" onClick={deleteEverything}>Delete all my data</button>
        </section>
      </form>
    </div>
  )
}

// Inputs sit inside a <label>; chip groups use a named group instead,
// because clicking a label would otherwise press the first chip.
function Field({ label, hint, group, children }) {
  if (group) {
    return (
      <div className="field" role="group" aria-label={label}>
        <span>{label}</span>
        {children}
        {hint && <small>{hint}</small>}
      </div>
    )
  }
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

function Chips({ options, picked, onToggle, single }) {
  return (
    <div className="chip-row" role={single ? 'radiogroup' : 'group'}>
      {options.map(([v, l]) => (
        <button type="button" key={v} className={`chip ${picked.includes(v) ? 'on' : ''}`}
                role={single ? 'radio' : undefined}
                aria-checked={single ? picked.includes(v) : undefined}
                aria-pressed={single ? undefined : picked.includes(v)}
                onClick={() => onToggle(v)}>{l}</button>
      ))}
    </div>
  )
}
