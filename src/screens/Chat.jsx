import { useEffect, useRef, useState } from 'react'
import { FunctionsHttpError, FunctionsFetchError, FunctionsRelayError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { localToday } from '../lib/dates'
import { prettyDate } from '../lib/cycle'
import { Logo } from '../App.jsx'
import { pushSupport, enablePush, explainPushError } from '../lib/push'
import { linkify } from '../lib/linkify.jsx'
import FeedbackSheet from './FeedbackSheet.jsx'

const LOG_LABELS = {
  period_start: 'Period started', period_end: 'Period ended', flow: 'Flow', pain: 'Pain',
  mood: 'Mood', energy: 'Energy', symptom: 'Symptom', sleep: 'Sleep', sex_drive: 'Sex drive', note: 'Note',
  hot_flash: 'Hot flush', night_sweat: 'Night sweat'
}

function greeting(profile) {
  const name = profile.name ? ` ${profile.name}` : ''
  if (profile.tone === 'facts') return `All set${name}. Tell me when your period starts, how you feel, or ask me anything about your cycle.`
  if (profile.tone === 'gentle') return `You're all set${name}. Whenever you're ready, tell me how you're feeling, or just say something like "my period started today".`
  return `Yay, we're all set${name}! 💜 Just talk to me like a friend: "got my period this morning", "cramps are bad today", or "what should I eat?"`
}

const MODE_NAMES = {
  cycles: 'Switched to cycle tracking', ttc: 'Switched to trying-to-conceive mode', pregnant: 'Switched to pregnancy mode',
  perimenopause: 'Switched to perimenopause mode', postmenopause: 'Switched to menopause mode'
}
function changeTags(c) {
  return [
    c.life_stage && MODE_NAMES[c.life_stage],
    c.due_date && `Due date: ${prettyDate(c.due_date)}`,
    c.ttc_since && !c.life_stage && `Trying since ${prettyDate(c.ttc_since)}`,
    c.name && `I'll call you ${c.name}`
  ].filter(Boolean)
}

export function cycleChip(c) {
  if (!c) return null
  switch (c.mode) {
    case 'cycle':
      return c.phase === 'late' ? `${c.lateBy} days late` : `Day ${c.day} · ${c.phase[0].toUpperCase()}${c.phase.slice(1)}`
    case 'no_phases': return 'Tracking bleeding'
    case 'pregnant': return c.pregnancy ? `Week ${c.pregnancy.week} · Pregnancy` : 'Pregnancy'
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

export default function Chat({ session, profile, onProfileChange, active = true, version = 0, onOpenCycle }) {
  const [messages, setMessages] = useState(null)
  const [cycle, setCycle] = useState(null)
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState(false)
  const [flagging, setFlagging] = useState(null) // the reply she's reporting
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

  // Something was logged on Today, or she came back to this tab: refresh the phase chip.
  useEffect(() => {
    if (!active) return
    supabase.functions.invoke('hera-chat', { body: { action: 'status', today: localToday() } })
      .then(({ data }) => data?.cycle && setCycle(data.cycle))
    setTimeout(() => bottom.current?.scrollIntoView(), 50)
  }, [active, version])

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])

  async function ask(message) {
    // Never wait more than a minute: Hera's server gives up on the AI after ~45 seconds anyway.
    const call = () => supabase.functions.invoke('hera-chat', { body: { message, today: localToday() }, timeout: 60_000 })
    const started = Date.now()
    let res = await call()
    if (res.error instanceof FunctionsFetchError) {
      // A quick drop usually means the request never arrived: retry once. A slow one timed out: don't make her wait twice.
      if (Date.now() - started > 10_000) return { ...res, slow: true }
      await new Promise(r => setTimeout(r, 1500))
      res = await call()
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

    const { data, error, slow } = await ask(message)
    setThinking(false)
    const reply = slow ? "Sorry babe, that took me way too long 🙈 Tap retry and I'll be quicker." : error ? await explain(error) : data.reply
    const failed = !!error || !!data?.error
    setMessages(m => [...m, {
      id: `hera-${Date.now()}`, role: 'hera', content: reply, logged: data?.logged,
      failed, detail: data?.detail, retry: failed ? message : undefined, safety: data?.safety_level,
      partnerAlerted: data?.partner_alerted, changes: data?.profile_changes
    }])
    // She switched modes or gave a due date in chat: keep the app in step.
    if (data?.profile_changes && Object.keys(data.profile_changes).length) onProfileChange({ ...profile, ...data.profile_changes })
    if (data?.cycle) setCycle(data.cycle)
    input.current?.focus()
  }

  const chip = cycleChip(cycle)

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand"><Logo size={32} /><span>Hera</span></div>
        {chip
          ? <button className={`phase ${cycle.phase || cycle.mode}`} onClick={onOpenCycle}
                    aria-label={`${chip}. Open my cycle`}>{chip}</button>
          : <span />}
      </header>

      <ReminderBanner userId={session.user.id} />

      <main className="chat" aria-live="polite">
        {messages === null && <div className="bubble hera typing"><span /><span /><span /></div>}
        {messages?.length === 0 && <div className="bubble hera">{greeting(profile)}</div>}
        {messages?.map(m => (
          <div key={m.id} className={`bubble ${m.role === 'user' ? 'me' : 'hera'} ${m.failed ? 'failed' : ''}`}>
            {m.role === 'user' ? m.content : linkify(m.content)}
            {m.detail && <div className="detail-line">Details: {m.detail}</div>}
            {m.failed && m.retry && (
              <button className="chip small retry" disabled={thinking} onClick={() => send(null, m.retry)}>Try again</button>
            )}
            {(m.safety === 'distress' || m.safety === 'danger') && <SafetyActions profile={profile} danger={m.safety === 'danger'} />}
            {m.changes && changeTags(m.changes).length > 0 && (
              <div className="logged">{changeTags(m.changes).map(t => <span key={t} className="tag">✓ {t}</span>)}</div>
            )}
            {m.role === 'hera' && !m.failed && (
              <button className="flag" onClick={() => setFlagging(m.content)} aria-label="Report a problem with this reply">Something wrong?</button>
            )}
            {m.partnerAlerted && <div className="partner-alerted">💜 I've asked {m.partnerAlerted} to check on you. They don't see what you said.</div>}
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
        {flagging && <FeedbackSheet reply={flagging} onClose={() => setFlagging(null)} />}
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
