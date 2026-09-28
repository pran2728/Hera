import { useEffect, useRef, useState } from 'react'
import { FunctionsHttpError, FunctionsFetchError, FunctionsRelayError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { localToday } from '../lib/dates'
import { prettyDate } from '../lib/cycle'
import { Logo } from '../App.jsx'
import MyCycle from './MyCycle.jsx'
import Profile from './Profile.jsx'
import { pushSupport, enablePush, explainPushError } from '../lib/push'

const LOG_LABELS = {
  period_start: 'Period started', period_end: 'Period ended', flow: 'Flow', pain: 'Pain',
  mood: 'Mood', energy: 'Energy', symptom: 'Symptom', sleep: 'Sleep', sex_drive: 'Sex drive', note: 'Note'
}

function greeting(profile) {
  const name = profile.name ? ` ${profile.name}` : ''
  if (profile.tone === 'facts') return `All set${name}. Tell me when your period starts, how you feel, or ask me anything about your cycle.`
  if (profile.tone === 'gentle') return `You're all set${name}. Whenever you're ready, tell me how you're feeling, or just say something like "my period started today".`
  return `Yay, we're all set${name}! 💜 Just talk to me like a friend: "got my period this morning", "cramps are bad today", or "what should I eat?"`
}

export function cycleChip(c) {
  if (!c) return null
  switch (c.mode) {
    case 'cycle':
      return c.phase === 'late' ? `${c.lateBy} days late` : `Day ${c.day} · ${c.phase[0].toUpperCase()}${c.phase.slice(1)}`
    case 'no_phases': return 'Tracking bleeding'
    case 'pregnant': return 'Pregnancy'
    case 'menopause': return 'Menopause'
    default: return null
  }
}

async function explain(error) {
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status
    let body = {}
    try { body = await error.context.json() } catch { /* not JSON */ }
    if (status === 404) return "My brain isn't connected yet: the hera-chat function isn't deployed in Supabase."
    if (body.error === 'not_signed_in') return 'Your login expired. Sign out and back in, babe.'
    if (body.error === 'onboarding_needed') return 'Please finish setting up first.'
    return `Something went wrong on my side (${status}). Try again in a moment?`
  }
  if (error instanceof FunctionsFetchError) return "I couldn't reach the server. Check your internet?"
  if (error instanceof FunctionsRelayError) return 'The server hiccupped. Try again?'
  return 'Something went wrong. Try again?'
}

export default function Chat({ session, profile, onProfileChange, onDeleted }) {
  const [messages, setMessages] = useState(null)
  const [cycle, setCycle] = useState(null)
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState(false)
  const [showCycle, setShowCycle] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const bottom = useRef(null)
  const input = useRef(null)

  // Load the chat, and reload it when she comes back to the app (Hera may have messaged her).
  useEffect(() => {
    const load = () => {
      supabase.from('messages').select('id, role, content, created_at')
        .order('created_at', { ascending: false }).limit(60)
        .then(({ data }) => data && setMessages(old => [
          ...data.reverse(),
          ...(old ?? []).filter(m => m.failed) // keep unsent failures visible
        ]))
      supabase.functions.invoke('hera-chat', { body: { action: 'status', today: localToday() } })
        .then(({ data }) => data?.cycle && setCycle(data.cycle))
    }
    load()
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])

  async function ask(message) {
    let res = await supabase.functions.invoke('hera-chat', { body: { message, today: localToday() } })
    // A dropped connection usually means the request never arrived: retry once.
    if (res.error instanceof FunctionsFetchError) {
      await new Promise(r => setTimeout(r, 1500))
      res = await supabase.functions.invoke('hera-chat', { body: { message, today: localToday() } })
    }
    return res
  }

  async function send(e, retryText) {
    e?.preventDefault()
    const message = (retryText ?? text).trim()
    if (!message || thinking) return
    if (retryText) {
      setMessages(m => m.filter(x => x.retry !== retryText || !x.failed)) // drop the failed reply
    } else {
      setText('')
      setMessages(m => [...m, { id: `me-${Date.now()}`, role: 'user', content: message }])
    }
    setThinking(true)

    const { data, error } = await ask(message)
    setThinking(false)
    const reply = error ? await explain(error) : data.reply
    const failed = !!error || !!data?.error
    setMessages(m => [...m, {
      id: `hera-${Date.now()}`, role: 'hera', content: reply, logged: data?.logged,
      failed, detail: data?.detail, retry: failed ? message : undefined, safety: data?.safety_level
    }])
    if (data?.cycle) setCycle(data.cycle)
    input.current?.focus()
  }

  const chip = cycleChip(cycle)

  if (showProfile) {
    return <Profile session={session} profile={profile} onSaved={onProfileChange} onDeleted={onDeleted}
                    onBack={() => setShowProfile(false)} />
  }

  if (showCycle) {
    return <MyCycle userId={session.user.id} onBack={() => {
      setShowCycle(false)
      supabase.functions.invoke('hera-chat', { body: { action: 'status', today: localToday() } })
        .then(({ data }) => data?.cycle && setCycle(data.cycle))
    }} />
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand"><Logo size={32} /><span>Hera</span></div>
        {chip
          ? <button className={`phase ${cycle.phase || cycle.mode}`} onClick={() => setShowCycle(true)}
                    aria-label={`${chip}. Open my cycle`}>{chip}</button>
          : <span />}
        <div className="topbar-actions">
          <button className="icon-btn" onClick={() => setShowCycle(true)} aria-label="My cycle" title="My cycle">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4.5" width="18" height="16.5" rx="3" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /><circle cx="12" cy="15.5" r="1.6" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <button className="icon-btn" onClick={() => setShowProfile(true)} aria-label="My profile" title="My profile">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </button>
        </div>
      </header>

      <ReminderBanner userId={session.user.id} />

      <main className="chat" aria-live="polite">
        {messages === null && <div className="bubble hera typing"><span /><span /><span /></div>}
        {messages?.length === 0 && <div className="bubble hera">{greeting(profile)}</div>}
        {messages?.map(m => (
          <div key={m.id} className={`bubble ${m.role === 'user' ? 'me' : 'hera'} ${m.failed ? 'failed' : ''}`}>
            {m.content}
            {m.detail && <div className="detail-line">Details: {m.detail}</div>}
            {m.failed && m.retry && (
              <button className="chip small retry" disabled={thinking} onClick={() => send(null, m.retry)}>Try again</button>
            )}
            {(m.safety === 'distress' || m.safety === 'danger') && <SafetyActions profile={profile} danger={m.safety === 'danger'} />}
            {m.logged?.length > 0 && (
              <div className="logged">
                {m.logged.map((l, i) => (
                  <span key={i} className="tag">
                    ✓ {LOG_LABELS[l.kind]}{l.value ? `: ${l.value}` : ''} · {prettyDate(l.date)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {thinking && <div className="bubble hera typing" aria-label="Hera is typing"><span /><span /><span /></div>}
        <div ref={bottom} />
      </main>

      <form className="composer" onSubmit={send}>
        <input
          ref={input}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Message Hera…"
          aria-label="Message Hera"
          enterKeyHint="send"
          maxLength={2000}
        />
        <button className="primary" disabled={!text.trim() || thinking}>Send</button>
      </form>
    </div>
  )
}

// Shown under a reply when she says she's not okay: help is one tap away.
function SafetyActions({ profile, danger }) {
  const msg = encodeURIComponent("Hey, I'm not doing okay right now. Can you call me or come over?")
  return (
    <div className="safety">
      <a className="safety-btn" href="tel:14416">Call Tele-MANAS 14416 (free, 24/7)</a>
      {profile.trusted_phone && (
        <a className="safety-btn" href={`https://wa.me/${profile.trusted_phone}?text=${msg}`} target="_blank" rel="noreferrer">
          Message {profile.trusted_name || 'your person'} now
        </a>
      )}
      {danger && <a className="safety-btn urgent" href="tel:112">Call 112 (emergency)</a>}
    </div>
  )
}

// A gentle nudge to turn on reminders, until she does or says no.
function ReminderBanner({ userId }) {
  const key = 'hera-reminder-banner-dismissed'
  const [support, setSupport] = useState(() => { try { return pushSupport() } catch { return 'unsupported' } })
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(key) === '1' } catch { return false } })
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const hide = () => { try { localStorage.setItem(key, '1') } catch { /* private mode */ } setHidden(true) }

  if (hidden || !['default', 'ios-install'].includes(support)) return note ? <div className="banner"><span>{note}</span></div> : null

  if (support === 'ios-install') {
    return (
      <div className="banner">
        <span>Want Hera's reminders? Add Hera to your Home Screen (Share → Add to Home Screen) and open her from there.</span>
        <button className="link" onClick={hide}>OK</button>
      </div>
    )
  }
  return (
    <div className="banner">
      <span>Let Hera remind you when your period's due and check in on you?</span>
      <div className="banner-actions">
        <button className="link" onClick={hide}>Not now</button>
        <button className="primary" disabled={busy} onClick={async () => {
          setBusy(true)
          try { await enablePush(userId); setNote('Reminders are on 💜 Change them anytime in My profile.') }
          catch (e) { setNote(explainPushError(e)) }
          setSupport(pushSupport()); setBusy(false); hide()
        }}>Turn on</button>
      </div>
    </div>
  )
}
