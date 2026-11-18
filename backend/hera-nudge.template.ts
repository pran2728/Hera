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
//   {action:"delete_account"} a signed-in user deletes their login and, through it, all their data

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
  if (!res.ok) {
    // Record WHY the phone's push service refused, so the logs and the test button can say it.
    const reason = `${new URL(sub.endpoint).host} ${res.status} ${(await res.text().catch(() => '')).slice(0, 120)}`.trim()
    pushProblems.push(reason)
    console.error('push refused:', reason)
  }
  return res.ok
}

// ---- One-off announcement to everyone with notifications on ----
// "{name}" in the text becomes each person's name (or is dropped if she has none).
async function broadcast(text: string, now: Date) {
  pushProblems = []
  const keys = await vapidKeys()
  const today = localClock(now, 'Asia/Kolkata').date
  const { data: subs } = await admin.from('push_subscriptions').select('*')
  const byUser = new Map<string, Sub[]>()
  for (const s of (subs ?? []) as Sub[]) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s])
  const { data: profiles } = await admin.from('profiles').select('*').in('id', [...byUser.keys()])
  // Only women who finished Hera's setup; partners never do, and get only partner reminders.
  const profileOf = new Map((profiles ?? []).filter((p: { onboarded_at?: string | null }) => p.onboarded_at)
    .map((p: { id: string }) => [p.id, p]))

  let people = 0, delivered = 0, skipped = 0
  let partnersSkipped = 0
  for (const [userId, phones] of byUser) {
    try {
      // Only women who use Hera themselves: partners have no Hera profile and get only partner reminders.
      if (!profileOf.has(userId)) { partnersSkipped++; continue }
      // Claim first: running the same broadcast twice in a day sends nothing the second time.
      const { error } = await admin.from('nudges_sent').insert({ user_id: userId, kind: 'broadcast', for_date: today })
      if (error) { skipped++; continue }
      const profile = profileOf.get(userId) as { name?: string } | undefined
      const name = profile?.name?.trim() || ''
      const msg = text.replace(/,?\s*\{name\}/g, m => name ? m.replace('{name}', name) : '')
      await admin.from('messages').insert({ user_id: userId, role: 'hera', content: msg })
      const ok = await pushAll(phones, { title: 'Hera', body: msg, tag: 'broadcast', url: '/' }, keys)
      await admin.from('nudges_sent').update({ phones: phones.length, delivered: ok })
        .eq('user_id', userId).eq('kind', 'broadcast').eq('for_date', today)
      delivered += ok
      people++
    } catch (e) {
      console.error('broadcast failed for one user:', String(e).slice(0, 200))
    }
  }
  const result = { people, phones: (subs ?? []).length, delivered, already_sent_today: skipped, partners_skipped: partnersSkipped, refused: [...new Set(pushProblems)].slice(0, 5) }
  console.log('broadcast:', JSON.stringify(result))
  return result
}

// ---- The 9 am report for Hera's admin (Pran) ----
// Sent once a day, in the run at 9:00 India time, to the account named in hera_settings 'report_to'.
// Counts only: never who got which reminder or what it said.
async function morningReport(now: Date, keys: { publicKey: string; privateKey: string }) {
  const clock = localClock(now, 'Asia/Kolkata')
  if (clock.minutes < 9 * 60 || clock.minutes >= 9 * 60 + 15) return null
  const to = await setting('report_to')
  if (!to) return null
  const today = clock.date
  // Claim today's report first, so a second run can't send it twice.
  const { error } = await admin.from('nudges_sent').insert({ user_id: to, kind: 'admin_report', for_date: today })
  if (error) return null

  const [{ data: subs }, { data: rows }, { data: links }] = await Promise.all([
    admin.from('push_subscriptions').select('*'),
    admin.from('nudges_sent').select('*').eq('for_date', today),
    admin.from('partner_links').select('*').not('partner_id', 'is', null)
  ])
  const all = (rows ?? []).filter((r: { kind: string }) => r.kind !== 'admin_report')
  const partnerRow = (r: { kind: string }) => r.kind.startsWith('partner_')
  // Women = people with notifications on who aren't only someone's partner.
  const partnerIds = new Set((links ?? []).map((l: { partner_id: string }) => l.partner_id))
  const womenIds = new Set((subs ?? []).map((s: { user_id: string }) => s.user_id).filter((id: string) => !partnerIds.has(id)))
  const women = womenIds.size
  const reminded = new Set(all.filter((r: { kind: string; user_id: string }) => !partnerRow(r) && womenIds.has(r.user_id))
    .map((r: { user_id: string }) => r.user_id)).size
  const partnersReminded = new Set(all.filter(partnerRow).map((r: { user_id: string }) => r.user_id)).size
  const tried = all.reduce((n: number, r: { phones?: number }) => n + (r.phones ?? 0), 0)
  const reached = all.reduce((n: number, r: { delivered?: number }) => n + (r.delivered ?? 0), 0)

  const lines = [`Reminders so far today: ${reminded} of ${women} ${women === 1 ? 'person' : 'people'} with notifications on`]
  if (partnersReminded) lines[0] += ` (+${partnersReminded} partner${partnersReminded === 1 ? '' : 's'})`
  lines.push(tried ? `Reached ${reached} of ${tried} phones${reached < tried ? ' ⚠️' : ' ✅'}` : 'No phones to reach yet')
  if (women > reminded) lines.push(`${women - reminded} not due yet (later time or nothing to say today)`)
  const refused = [...new Set(pushProblems)]
  if (refused.length) lines.push(`Refused: ${refused[0]}`)
  const body = lines.join('\n')

  const { data: mine } = await admin.from('push_subscriptions').select('*').eq('user_id', to)
  await pushAll((mine ?? []) as Sub[], { title: '☀️ Hera 9 am report', body, tag: 'admin_report', url: '/' }, keys)
  console.log('morning report:', body.replace(/\n/g, ' | '))
  return body
}

// Refusals from push services during the current request (reset at the start of each one).
let pushProblems: string[] = []

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
  pushProblems = []
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

  let count = 0, failed = 0, delivered = 0
  for (const p of profiles ?? []) {
    if (!byUser.has(p.id)) continue // she hasn't turned on notifications herself
    // One person's problem must never stop everyone else's reminders.
    try {
      const { starts, ends } = periodsOf(p.id)
      const already = (sent ?? []).filter((s: { user_id: string }) => s.user_id === p.id)
      const nudge = dueNudge(p, starts, ends, already, now)
      if (!nudge) continue

      // Claim it first: the table's key makes a second run skip the same reminder.
      const { error: claimErr } = await admin.from('nudges_sent').insert({ user_id: p.id, kind: nudge.kind, for_date: nudge.for_date })
      if (claimErr) continue

      await admin.from('messages').insert({ user_id: p.id, role: 'hera', content: nudge.text })
      const phones = byUser.get(p.id) ?? []
      const ok = await pushAll(phones, { title: 'Hera', body: nudge.text, tag: nudge.kind, url: '/' }, keys)
      delivered += ok
      await admin.from('nudges_sent').update({ phones: phones.length, delivered: ok })
        .eq('user_id', p.id).eq('kind', nudge.kind).eq('for_date', nudge.for_date)
      count++
    } catch (e) {
      failed++
      console.error('nudge failed for one user:', String(e).slice(0, 300))
    }
  }

  // ---- Partner nudges: timed by HER settings, sent to the partner's devices only ----
  let partnerCount = 0
  for (const link of partnerLinks) {
    try {
      const her = (profiles ?? []).find((p: { id: string }) => p.id === link.owner_id)
      if (!her) continue
      const already = (sent ?? []).filter((s: { user_id: string }) => s.user_id === link.partner_id)
      const nudge = duePartnerNudge(her, link, periodsOf(her.id).starts, already, now)
      if (!nudge) continue
      const { error: claimErr } = await admin.from('nudges_sent').insert({ user_id: link.partner_id, kind: nudge.kind, for_date: nudge.for_date })
      if (claimErr) continue
      const phones = byUser.get(link.partner_id) ?? []
      const ok = await pushAll(phones, { title: 'Hera', body: nudge.text, tag: nudge.kind, url: '/' }, keys)
      await admin.from('nudges_sent').update({ phones: phones.length, delivered: ok })
        .eq('user_id', link.partner_id).eq('kind', nudge.kind).eq('for_date', nudge.for_date)
      partnerCount++
    } catch (e) {
      failed++
      console.error('partner nudge failed:', String(e).slice(0, 300))
    }
  }
  // Pran's 9 am report on how today's reminders went (only in the run at 9:00 India time).
  let report: string | null = null
  try { report = await morningReport(now, keys) } catch (e) { console.error('morning report failed:', String(e).slice(0, 200)) }

  // phones = devices with notifications on; delivered = phones that accepted today's pushes
  return { ...(report ? { report } : {}), checked: (profiles ?? []).length, phones: (subs ?? []).length, sent: count, delivered, partners: partnerCount, failed,
    refused: [...new Set(pushProblems)].slice(0, 5) }
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
    ...partnerView(her ?? {}, cycle, today, link.share_dates !== false),
    nudges: { heads_up: link.notify_heads_up, tips: link.notify_tips, crisis: link.notify_crisis, dates: link.share_dates !== false }
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

    if (['test', 'partner_view', 'crisis', 'delete_account'].includes(body.action)) {
      const user = await signedInUser(req)
      if (!user) return json({ error: 'not_signed_in' }, 401)
      if (body.action === 'delete_account') {
        // Every table points at the login with "on delete cascade", so this removes everything.
        const { error } = await admin.auth.admin.deleteUser(user.id)
        if (error) { console.error('delete_account failed:', error.message); return json({ error: 'delete_failed' }, 500) }
        console.log('account deleted')
        return json({ deleted: true })
      }
      if (body.action === 'partner_view') return json(await partnerScreen(user.id))
      if (body.action === 'crisis') return json(await alertPartner(user.id))
      pushProblems = []
      const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', user.id)
      const ok = await pushAll((subs ?? []) as Sub[], { title: 'Hera', body: "This is how my reminders will look 💜", tag: 'test', url: '/' }, await vapidKeys())
      return json({ devices: (subs ?? []).length, delivered: ok, refused: [...new Set(pushProblems)] })
    }

    // One-off announcement from Pran to everyone with notifications on (run from the SQL Editor; see README).
    // Same secret as the schedule, so no app user can trigger it. Once per day: a second call the same day is skipped.
    if (body.action === 'broadcast') {
      const secret = await setting('cron_secret')
      if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403)
      const text = String(body.text ?? '').trim()
      if (!text || text.length > 300) return json({ error: 'text must be 1-300 characters' }, 400)
      return json(await broadcast(text, new Date()))
    }

    if (body.action === 'run') {
      const secret = await setting('cron_secret')
      if (!secret || req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403)
      // HERA_TEST_NOW lets the tests run a batch at a chosen time; it is never set in Supabase.
      const result = await runBatch(Deno.env.get('HERA_TEST_NOW') ? new Date(Deno.env.get('HERA_TEST_NOW')!) : new Date())
      console.log('nudge run:', JSON.stringify(result))
      return json(result)
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    console.error('hera-nudge failed:', e)
    return json({ error: 'server_error' }, 500)
  }
})
