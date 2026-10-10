// Partner mode helpers: invite codes, the invite link, and joining as a partner.
import { supabase } from './supabase'

const KEY = 'hera-invite'
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // no look-alikes (l/1, o/0, i)

export function newInviteCode(length = 12) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('')
}

export function inviteLink(code) {
  return `${window.location.origin}/?invite=${code}`
}

export function inviteMessage(name, code) {
  return `I'm using Hera, my cycle companion. Join as my partner and she'll give you a heads-up before my period, ` +
    `plus simple tips on how to support me. You'll never see my chats 💜\n\n${inviteLink(code)}`
}

// Opened from an invite link? Remember the code (it must survive sign-up and email confirmation).
export function captureInviteFromUrl() {
  try {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('invite')
    if (!code) return
    if (/^[a-z0-9]{10,40}$/i.test(code)) localStorage.setItem(KEY, code)
    url.searchParams.delete('invite')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  } catch { /* private mode */ }
}

export function pendingInvite() {
  try { return localStorage.getItem(KEY) } catch { return null }
}

export function clearInvite() {
  try { localStorage.removeItem(KEY) } catch { /* private mode */ }
}

const ERRORS = {
  invite_not_found: "That invite link doesn't work. Ask her to send a fresh one from Hera → My profile → Partner.",
  invite_used: 'Someone else already joined with this link. Ask her for a new one.',
  invite_expired: 'This invite is more than 7 days old. Ask her to send a new one.',
  own_invite: "That's your own invite link, silly 💜 Send it to your partner instead.",
  already_partner: "You're already connected as someone's partner on this account."
}

export async function acceptInvite(code, displayName) {
  const { data, error } = await supabase.rpc('accept_partner_invite', { code, display_name: displayName })
  if (!error) return { herName: data }
  const key = Object.keys(ERRORS).find(k => error.message?.includes(k))
  if (key) return { error: ERRORS[key] }
  if (/function .*does not exist|schema cache/i.test(error.message)) {
    return { error: "Hera's database needs the partner update (run backend/database.sql in Supabase again)." }
  }
  return { error: error.message || 'Something went wrong. Try again?' }
}
