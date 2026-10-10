// Hera's reminders (Supabase Edge Function "hera-nudge").
// GENERATED FILE SOURCE: edit backend/hera-nudge.template.ts, then run `npm run build:function`.
// Paste the generated backend/hera-nudge.ts into Supabase → Edge Functions → hera-nudge (Verify JWT off).
//
// Jobs:
//   {action:"run"}           every 15 minutes from Supabase Cron (needs the x-cron-secret header)
//   {action:"public_key"}    the app asks for the key it needs to subscribe to notifications
//   {action:"test"}          a signed-in user asks for a test notification
//   {action:"partner_view"}  a signed-in partner asks for her phase + today's tip (nothing else)
//   {action:"crisis"}        hera-chat, on her behalf, when she says she's not okay

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

async function pushTo(sub: Sub, payload: Record<string, string>, keys: { publicKey: string; privateKey: string }, urgent = false) {
  const d = webpush.generateRequestDetails(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
    { TTL: urgent ? 6 * 3600 : 24 * 3600, urgency: urgent ? 'high' : 'normal', vapidDetails: { subject: APP_URL, ...keys } }
  )
  const headers: Record<string, string> = {}
  for (const [k, v] of Object.entries(d.headers)) headers[k] = String(v)
  const res = await fetch(d.endpoint, { method: 'POST', headers, body: d.body })
  if (res.status === 404 || res.status === 410) {
    await admin.from('push_subscriptions').delete().eq('id', sub.id) // phone unsubscribed or app removed
  }
  return res.ok
}

async function pushAll(subs: Sub[], payload: Record<string, string>, keys: { publicKey: string; privateKey: string }, urgent = false) {
  let ok = 0
  for (const sub of subs) {
    try { if (await pushTo(sub, payload, keys, urgent)) ok++ } catch (e) { console.error('push failed:', String(e)) }
  }
  return ok
}

// Who is calling (for the app's own requests). We check the login ourselves.
async function signedInUser(req: Request) {
  const user = createClient(Deno.env.get('SUPABASE_URL')!, req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false }
  })
  const { data } = await user.auth.getUser()
  return data?.user ?? null
}

async function periodStarts(userId: string) {
  const { data } = await admin.from('cycle_logs').select('log_date').eq('user_id', userId)
    .eq('kind', 'period_start').order('log_date', { ascending: false }).limit(13)
  return (data ?? []).map((l: { log_date: string }) => l.log_date)
}

async function runBatch(now: Date) {
  const keys = await vapidKeys()
  const { data: subs } = await admin.from('push_subscriptions').select('*')
  const byUser = new Map<string, Sub[]>()
  for (const s of (subs ?? []) as Sub[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s])
  // Partners who have notifications on, and the women they support.
  const { data: links } = await admin.from('partner_links').select('*').not('partner_id', 'is', null)
  const partnerLinks = (links ?? []).filter((l: { partner_id: string }) => byUser.has(l.partner_id))
  const ids = [...new Set([...byUser.keys(), ...partnerLinks.map((l: { owner_id: string }) => l.owner_id)])]
  if (!ids.length) return { checked: 0, sent: 0, partners: 0 }
  const sentIds = [...ids, ...partnerLinks.map((l: { partner_id: string }) => l.partner_id)]

  const utcToday = now.toISOString().slice(0, 10)
  const [{ data: profiles }, { data: logs }, { data: sent }] = await Promise.all([
    admin.from('profiles').select('*').in('id', ids).not('onboarded_at', 'is', null),
    admin.from('cycle_logs').select('user_id, log_date, kind').in('user_id', ids)
      .in('kind', ['period_start', 'period_end']).gte('log_date', addDays(utcToday, -200)),
    admin.from('nudges_sent').select('user_id, kind, for_date').in('user_id', sentIds).gte('for_date', addDays(utcToday, -3))
  ])

  const periodsOf = (id: string) => {
    const mine = (logs ?? []).filter((l: { user_id: string }) => l.user_id === id)
    return {
      starts: mine.filter((l: { kind: string }) => l.kind === 'period_start').map((l: { log_date: string }) => l.log_date),
      ends: mine.filter((l: { kind: string }) => l.kind === 'period_end').map((l: { log_date: string }) => l.log_date)
    }
  }

  let count = 0
  for (const p of profiles ?? []) {
    if (!byUser.has(p.id)) continue // she hasn't turned on notifications herself
    const { starts, ends } = periodsOf(p.id)
    const already = (sent ?? []).filter((s: { user_id: string }) => s.user_id === p.id)
    const nudge = dueNudge(p, starts, ends, already, now)
    if (!nudge) continue

    // Claim it first: the table's key makes a second run skip the same reminder.
    const { error: claimErr } = await admin.from('nudges_sent').insert({ user_id: p.id, kind: nudge.kind, for_date: nudge.for_date })
    if (claimErr) continue

    await admin.from('messages').insert({ user_id: p.id, role: 'hera', content: nudge.text })
    await pushAll(byUser.get(p.id) ?? [], { title: 'Hera', body: nudge.text, tag: nudge.kind, url: '/' }, keys)
    count++
  }

  // ---- Partner nudges: timed by HER settings, sent to the partner's devices only ----
  let partnerCount = 0
  for (const link of partnerLinks) {
    const her = (profiles ?? []).find((p: { id: string }) => p.id === link.owner_id)
    if (!her) continue
    const already = (sent ?? []).filter((s: { user_id: string }) => s.user_id === link.partner_id)
    const nudge = duePartnerNudge(her, link, periodsOf(her.id).starts, already, now)
    if (!nudge) continue
    const { error: claimErr } = await admin.from('nudges_sent').insert({ user_id: link.partner_id, kind: nudge.kind, for_date: nudge.for_date })
    if (claimErr) continue
    await pushAll(byUser.get(link.partner_id) ?? [], { title: 'Hera', body: nudge.text, tag: nudge.kind, url: '/' }, keys)
    partnerCount++
  }
  return { checked: (profiles ?? []).length, sent: count, partners: partnerCount }
}

// She told Hera she's not okay: tell her partner to check on her (never what she said).
async function alertPartner(userId: string) {
  const { data: link } = await admin.from('partner_links').select('*').eq('owner_id', userId)
    .not('partner_id', 'is', null).maybeSingle()
  if (!link || !link.notify_crisis) return { alerted: false }
  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', link.partner_id)
  if (!subs?.length) return { alerted: false }
  // At most one alert every 3 hours, so a long hard conversation doesn't flood them.
  const since = new Date(Date.now() - 3 * 3600 * 1000).toISOString()
  const { data: recent } = await admin.from('nudges_sent').select('sent_at').eq('user_id', link.partner_id)
    .eq('kind', 'partner_crisis').gte('sent_at', since).limit(1)
  if (recent?.length) return { alerted: true, partner_name: link.partner_name }
  const { data: her } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle()
  const now = new Date()
  await admin.from('nudges_sent').upsert(
    { user_id: link.partner_id, kind: 'partner_crisis', for_date: localClock(now, her?.timezone || 'Asia/Kolkata').date, sent_at: now.toISOString() },
    { onConflict: 'user_id,kind,for_date' })
  const text = partnerText('partner_crisis', her ?? {}, { mode: 'unknown' }, '2026-01-01')
  const ok = await pushAll(subs as Sub[], { title: 'Hera', body: text, tag: 'partner_crisis', url: '/' }, await vapidKeys(), true)
  return { alerted: ok > 0, partner_name: link.partner_name }
}

// The partner screen: her first name, phase and a tip. Nothing else leaves the database.
async function partnerScreen(partnerId: string) {
  const { data: link } = await admin.from('partner_links').select('*').eq('partner_id', partnerId).maybeSingle()
  if (!link) return { linked: false }
  const { data: her } = await admin.from('profiles').select('*').eq('id', link.owner_id).maybeSingle()
  const today = localClock(new Date(), her?.timezone || 'Asia/Kolkata').date
  const cycle = her?.onboarded_at ? computeCycle(her, await periodStarts(link.owner_id), today) : { mode: 'unknown' }
  return {
    linked: true,
    ...partnerView(her ?? {}, cycle, today),
    nudges: { heads_up: link.notify_heads_up, tips: link.notify_tips, crisis: link.notify_crisis }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405)
  try {
    const body = await req.json().catch(() => ({}))

    if (body.action === 'public_key') {
      return json({ publicKey: (await vapidKeys()).publicKey })
    }

    if (['test', 'partner_view', 'crisis'].includes(body.action)) {
      const user = await signedInUser(req)
      if (!user) return json({ error: 'not_signed_in' }, 401)
      if (body.action === 'partner_view') return json(await partnerScreen(user.id))
      if (body.action === 'crisis') return json(await alertPartner(user.id))
      const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', user.id)
      const ok = await pushAll((subs ?? []) as Sub[], { title: 'Hera', body: "This is how my reminders will look 💜", tag: 'test', url: '/' }, await vapidKeys())
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
