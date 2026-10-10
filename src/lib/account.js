// "Download my data" and "Delete my account".
import { supabase } from './supabase'

async function all(table, filter) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    let q = supabase.from(table).select('*').range(from, from + 999)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) return { rows, error }
    rows.push(...data)
    if (data.length < 1000) return { rows }
  }
}

// Everything Hera has for this account, as one JSON file.
export async function exportData(user) {
  const out = { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email, created_at: user.created_at } }
  const tables = {
    profile: ['profiles', q => q.eq('id', user.id)],
    messages: ['messages', q => q.order('created_at')],
    logs: ['cycle_logs', q => q.order('log_date')],
    partner: ['partner_links'],
    devices: ['push_subscriptions'],
    reminders_sent: ['nudges_sent'],
    feedback: ['feedback']
  }
  for (const [key, [table, filter]] of Object.entries(tables)) {
    const { rows, error } = await all(table, filter)
    out[key] = error ? { error: 'not available' } : rows.map(({ endpoint, p256dh, auth, invite_code, ...rest }) =>
      table === 'push_subscriptions' ? { id: rest.id, created_at: rest.created_at } : rest)
  }
  return out
}

export async function downloadData(user) {
  const data = await exportData(user)
  const name = `hera-data-${new Date().toISOString().slice(0, 10)}.json`
  const file = new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' })
  // On phones, the share sheet is the reliable way to save a file.
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'My Hera data' }); return 'shared' } catch { /* closed the sheet */ return 'cancelled' }
  }
  const url = URL.createObjectURL(file)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}

export async function deleteAccount() {
  const { data, error } = await supabase.functions.invoke('hera-nudge', { body: { action: 'delete_account' } })
  if (error || !data?.deleted) throw new Error("Couldn't delete your account right now. Try again in a minute.")
  try { Object.keys(localStorage).filter(k => k.startsWith('hera-')).forEach(k => localStorage.removeItem(k)) } catch { /* private mode */ }
  await supabase.auth.signOut().catch(() => {})
}

// Open the privacy policy from anywhere in the app.
export function openPrivacy() {
  window.dispatchEvent(new Event('hera-privacy'))
}
