// Hera's reminders (Supabase Edge Function "hera-nudge").
// GENERATED FILE SOURCE: edit backend/hera-nudge.template.ts, then run `npm run build:function`.
// Paste the generated backend/hera-nudge.ts into Supabase → Edge Functions → hera-nudge (Verify JWT off).
//
// Three jobs:
//   {action:"run"}         every 15 minutes from Supabase Cron (needs the x-cron-secret header)
//   {action:"public_key"}  the app asks for the key it needs to subscribe to notifications
//   {action:"test"}        a signed-in woman asks for a test notification

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// @@SHARED@@

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const APP_URL = 'https://hera-ecru.vercel.app'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// Server key: the new secret key if present, else the legacy service role key.
function serverKey() {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}')
    const first = Object.values(keys)[0]
    if (first) return String(first)
  } catch { /* not set */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), { auth: { persistSession: false } })

async function setting(key: string) {
  const { data } = await admin.from('hera_settings').select('value').eq('key', key).maybeSingle()
  return data?.value as string | undefined
}

// Notification keys are created once, on first use, and kept in hera_settings.
async function vapidKeys() {
  let pub = await setting('vapid_public'), priv = await setting('vapid_private')
  if (!pub || !priv) {
    const k = webpush.generateVAPIDKeys()
    await admin.from('hera_settings').insert([{ key: 'vapid_public', value: k.publicKey }, { key: 'vapid_private', value: k.privateKey }])
    pub = await setting('vapid_public'); priv = await setting('vapid_private') // another run may have won the race
  }
  return { publicKey: pub!, privateKey: priv! }
}

type Sub = { id: number; user_id: string; endpoint: string; p256dh: string; auth: string }

async function pushTo(sub: Sub, payload: Record<string, string>, keys: { publicKey: string; privateKey: string }) {
  const d = webpush.generateRequestDetails(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
    { TTL: 24 * 3600, urgency: 'normal', vapidDetails: { subject: APP_URL, ...keys } }
  )
  const headers: Record<string, string> = {}
  for (const [k, v] of Object.entries(d.headers)) headers[k] = String(v)
  const res = await fetch(d.endpoint, { method: 'POST', headers, body: d.body })
  if (res.status === 404 || res.status === 410) {
    await admin.from('push_subscriptions').delete().eq('id', sub.id) // phone unsubscribed or app removed
  }
  return res.ok
}

async function runBatch(now: Date) {
  const keys = await vapidKeys()
  const { data: subs } = await admin.from('push_subscriptions').select('*')
  const byUser = new Map<string, Sub[]>()
  for (const s of (subs ?? []) as Sub[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s])
  const ids = [...byUser.keys()]
  if (!ids.length) return { checked: 0, sent: 0 }

  const utcToday = now.toISOString().slice(0, 10)
  const [{ data: profiles }, { data: logs }, { data: sent }] = await Promise.all([
    admin.from('profiles').select('*').in('id', ids).not('onboarded_at', 'is', null),
    admin.from('cycle_logs').select('user_id, log_date, kind').in('user_id', ids)
      .in('kind', ['period_start', 'period_end']).gte('log_date', addDays(utcToday, -200)),
    admin.from('nudges_sent').select('user_id, kind, for_date').in('user_id', ids).gte('for_date', addDays(utcToday, -3))
  ])

  let count = 0
  for (const p of profiles ?? []) {
    const mine = (logs ?? []).filter((l: { user_id: string }) => l.user_id === p.id)
    const starts = mine.filter((l: { kind: string }) => l.kind === 'period_start').map((l: { log_date: string }) => l.log_date)
    const ends = mine.filter((l: { kind: string }) => l.kind === 'period_end').map((l: { log_date: string }) => l.log_date)
    const already = (sent ?? []).filter((s: { user_id: string }) => s.user_id === p.id)
    const nudge = dueNudge(p, starts, ends, already, now)
    if (!nudge) continue

    // Claim it first: the table's key makes a second run skip the same reminder.
    const { error: claimErr } = await admin.from('nudges_sent').insert({ user_id: p.id, kind: nudge.kind, for_date: nudge.for_date })
    if (claimErr) continue

    await admin.from('messages').insert({ user_id: p.id, role: 'hera', content: nudge.text })
    for (const sub of byUser.get(p.id) ?? []) {
      try {
        await pushTo(sub, { title: 'Hera', body: nudge.text, tag: nudge.kind, url: '/' }, keys)
      } catch (e) {
        console.error('push failed:', String(e))
      }
    }
    count++
  }
  return { checked: (profiles ?? []).length, sent: count }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  try {
    const body = await req.json().catch(() => ({}))

    if (body.action === 'public_key') {
      return json({ publicKey: (await vapidKeys()).publicKey })
    }

    if (body.action === 'test') {
      const user = createClient(Deno.env.get('SUPABASE_URL')!, req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
        auth: { persistSession: false }
      })
      const { data } = await user.auth.getUser()
      if (!data?.user) return json({ error: 'not_signed_in' }, 401)
      const keys = await vapidKeys()
      const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', data.user.id)
      let ok = 0
      for (const sub of (subs ?? []) as Sub[]) if (await pushTo(sub, { title: 'Hera', body: "This is how my reminders will look 💜", tag: 'test', url: '/' }, keys)) ok++
      return json({ devices: (subs ?? []).length, delivered: ok })
    }

    if (body.action === 'run') {
      const secret = await setting('cron_secret')
      if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403)
      const result = await runBatch(new Date())
      console.log('nudge run:', JSON.stringify(result))
      return json(result)
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    console.error('hera-nudge failed:', e)
    return json({ error: 'server_error' }, 500)
  }
})
