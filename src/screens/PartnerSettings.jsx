import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { newInviteCode, inviteLink, inviteMessage } from '../lib/partner'

const WEEK = 7 * 86400000

// Her side of partner mode, inside My profile: invite, choose nudges, disconnect.
export default function PartnerSettings({ profile }) {
  const [link, setLink] = useState(undefined) // undefined = loading, null = none
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error } = await supabase.from('partner_links').select('*').eq('owner_id', profile.id).maybeSingle()
    if (error) { setNote(/schema cache|does not exist/i.test(error.message) ? "Partner mode needs a database update: run backend/database.sql in Supabase again." : error.message); setLink(null) }
    else setLink(data)
  }
  useEffect(() => { load() }, [])

  async function create() {
    setBusy(true); setNote('')
    if (link) await supabase.from('partner_links').delete().eq('id', link.id) // replace an expired invite
    const { data, error } = await supabase.from('partner_links').insert({ invite_code: newInviteCode() }).select().single()
    setBusy(false)
    if (error) setNote(error.message); else setLink(data)
  }

  async function remove(question) {
    if (!confirm(question)) return
    setBusy(true)
    await supabase.from('partner_links').delete().eq('id', link.id)
    setBusy(false); setLink(null); setNote('')
  }

  async function setNudge(key, value) {
    setLink(l => ({ ...l, [key]: value }))
    const { error } = await supabase.from('partner_links').update({ [key]: value }).eq('id', link.id)
    if (error) { setNote("Couldn't save that. Try again?"); load() }
  }

  async function share() {
    const text = inviteMessage(profile.name, link.invite_code)
    try {
      if (navigator.share) { await navigator.share({ text }); return }
    } catch { return /* she closed the share sheet */ }
    copy()
  }
  async function copy() {
    try { await navigator.clipboard.writeText(inviteLink(link.invite_code)); setNote('Link copied 💜') }
    catch { setNote(inviteLink(link.invite_code)) }
  }

  if (link === undefined) return <p className="muted small">Loading…</p>

  // ---- Not invited yet ----
  if (!link) {
    return (
      <>
        <p className="muted small">
          Invite your partner and Hera will give them a heads-up before your period and simple tips on how to support you.
          They'll never see your chats, logs or symptoms.
        </p>
        <button type="button" className="primary" disabled={busy} onClick={create}>Create invite link</button>
        {note && <p className="muted small" role="status">{note}</p>}
      </>
    )
  }

  // ---- Invite sent, waiting ----
  if (!link.partner_id) {
    const expired = Date.now() - new Date(link.created_at).getTime() > WEEK
    if (expired) {
      return (
        <>
          <p className="muted small">Your invite link expired before anyone joined.</p>
          <button type="button" className="primary" disabled={busy} onClick={create}>Make a new link</button>
        </>
      )
    }
    return (
      <>
        <p className="muted small">Send this link to your partner. It works once, for 7 days.</p>
        <div className="invite-box">{inviteLink(link.invite_code)}</div>
        <div className="btn-row">
          <button type="button" className="primary" onClick={share}>Share</button>
          <a className="chip" href={`https://wa.me/?text=${encodeURIComponent(inviteMessage(profile.name, link.invite_code))}`}
             target="_blank" rel="noreferrer">WhatsApp</a>
          <button type="button" className="chip" onClick={copy}>Copy</button>
        </div>
        {note && <p className="muted small" role="status">{note}</p>}
        <button type="button" className="link left" disabled={busy} onClick={() => remove('Cancel this invite?')}>Cancel invite</button>
      </>
    )
  }

  // ---- Connected ----
  const who = link.partner_name || 'Your partner'
  return (
    <>
      <p className="connected">💜 Connected with <strong>{who}</strong></p>
      <p className="muted small">{who} sees your phase and a tip for the day. Never your chats, logs or symptoms. Choose what they get (saves right away):</p>
      <label className="toggle">
        <input type="checkbox" checked={link.notify_heads_up} onChange={e => setNudge('notify_heads_up', e.target.checked)} />
        <span>Heads-up 2 days before my period</span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={link.notify_tips} onChange={e => setNudge('notify_tips', e.target.checked)} />
        <span>Weekly tip on how to support me (on my check-in day)</span>
      </label>
      <label className="toggle">
        <input type="checkbox" checked={link.notify_crisis} onChange={e => setNudge('notify_crisis', e.target.checked)} />
        <span>If I tell Hera I'm not okay, ask {who} to check on me (never what I said)</span>
      </label>
      {note && <p className="muted small" role="status">{note}</p>}
      <button type="button" className="link left danger" disabled={busy}
              onClick={() => remove(`Disconnect ${who}? They'll stop getting nudges right away.`)}>Disconnect {who}</button>
    </>
  )
}
