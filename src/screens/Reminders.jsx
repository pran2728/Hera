import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { pushSupport, currentSubscription, enablePush, disablePush, sendTestPush, explainPushError } from '../lib/push'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Notification switch for this device (acts immediately).
export function NotificationsSwitch({ userId }) {
  const [support, setSupport] = useState(() => pushSupport())
  const [on, setOn] = useState(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (support === 'granted') currentSubscription().then(s => setOn(!!s)).catch(() => setOn(false))
    else setOn(false)
  }, [support])

  async function turnOn() {
    setBusy(true); setNote('')
    try { await enablePush(userId); setOn(true); setNote('Reminders are on for this device 💜') }
    catch (e) { setNote(explainPushError(e)) }
    setSupport(pushSupport()); setBusy(false)
  }
  async function turnOff() {
    setBusy(true); await disablePush().catch(() => {}); setOn(false); setBusy(false); setNote('Reminders are off for this device.')
  }
  async function test() {
    setBusy(true); setNote('')
    const { data, error } = await sendTestPush()
    setNote(error ? "Couldn't send a test. Is the hera-nudge function deployed?"
      : data.delivered ? 'Sent! It should pop up in a few seconds.' : 'No device is signed up yet. Turn reminders on first.')
    setBusy(false)
  }

  if (support === 'ios-install') {
    return <p className="muted small">To get reminders on iPhone, add Hera to your Home Screen (Safari → Share → Add to Home Screen), then open Hera from that icon and come back here.</p>
  }
  if (support === 'unsupported') {
    return <p className="muted small">This browser can't show notifications. Try Chrome on Android, or Hera from the Home Screen on iPhone (iOS 16.4 or newer).</p>
  }

  return (
    <div className="notif">
      <div className="notif-row">
        <span>{on ? 'Reminders on this device' : 'Reminders are off'}</span>
        {on
          ? <button type="button" className="link" disabled={busy} onClick={turnOff}>Turn off</button>
          : <button type="button" className="primary" disabled={busy || support === 'denied'} onClick={turnOn}>Turn on</button>}
      </div>
      {on && <button type="button" className="chip small" disabled={busy} onClick={test}>Send me a test</button>}
      {support === 'denied' && !note && <p className="muted small">{explainPushError('denied')}</p>}
      {note && <p className="muted small" role="status">{note}</p>}
    </div>
  )
}

// Reminder preferences (saved with the rest of the profile).
export function ReminderSettings({ f, set }) {
  return (
    <>
      <div className="two">
        <label className="field">
          <span>Reminders from</span>
          <input type="time" value={f.nudge_time} onChange={e => set('nudge_time', e.target.value)} />
        </label>
        <label className="field">
          <span>Weekly check-in on</span>
          <select value={f.checkin_day} onChange={e => set('checkin_day', Number(e.target.value))}>
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
        </label>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={f.daily_tips} onChange={e => set('daily_tips', e.target.checked)} />
        <span>Daily tip for my phase (food, water, movement)</span>
      </label>
      <div className="two">
        <label className="field">
          <span>Quiet from</span>
          <input type="time" value={f.quiet_start} onChange={e => set('quiet_start', e.target.value)} />
        </label>
        <label className="field">
          <span>Quiet until</span>
          <input type="time" value={f.quiet_end} onChange={e => set('quiet_end', e.target.value)} />
        </label>
      </div>
    </>
  )
}

// Pause all reminders for a week (acts immediately).
export function PauseButton({ userId, profile, onSaved }) {
  const paused = profile.paused_until && new Date(profile.paused_until) > new Date()
  async function toggle() {
    const paused_until = paused ? null : new Date(Date.now() + 7 * 86400000).toISOString()
    const { data, error } = await supabase.from('profiles').update({ paused_until }).eq('id', userId).select().single()
    if (!error) onSaved(data)
  }
  return (
    <div className="notif-row">
      <span className="muted small">
        {paused ? `Paused until ${new Date(profile.paused_until).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Need a break?'}
      </span>
      <button type="button" className="link" onClick={toggle}>{paused ? 'Resume now' : 'Pause for a week'}</button>
    </div>
  )
}
