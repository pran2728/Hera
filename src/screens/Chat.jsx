import { useEffect, useRef, useState } from 'react'
import { FunctionsHttpError, FunctionsFetchError, FunctionsRelayError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { localToday } from '../lib/dates'
import { prettyDate } from '../lib/cycle'
import { Logo } from '../App.jsx'
import MyCycle from './MyCycle.jsx'
import Profile from './Profile.jsx'

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

  useEffect(() => {
    supabase.from('messages').select('id, role, content, created_at')
      .order('created_at', { ascending: false }).limit(60)
      .then(({ data }) => setMessages((data ?? []).reverse()))
    supabase.functions.invoke('hera-chat', { body: { action: 'status', today: localToday() } })
      .then(({ data }) => data?.cycle && setCycle(data.cycle))
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
      failed, detail: data?.detail, retry: failed ? message : undefined
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
