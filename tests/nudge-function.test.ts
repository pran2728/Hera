import { db, deletedUsers } from './mocks/supabase-admin.js'
import ece from 'npm:http_ece@1.2.0'
import { createECDH, randomBytes } from 'node:crypto'
function assert(c: unknown, m = 'assertion failed') { if (!c) throw new Error(m) }
function eq(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`) }

Deno.env.set('SUPABASE_URL', 'http://x'); Deno.env.set('SUPABASE_SECRET_KEYS', '{"default":"sb_secret_x"}')
const realFetch = globalThis.fetch
const phone = createECDH('prime256v1'); phone.generateKeys(); const authSecret = randomBytes(16)
const pushes: string[] = []; let phoneStatus = 201
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (String(url).startsWith('https://push.example')) {
    pushes.push(ece.decrypt(Buffer.from(init!.body as Uint8Array), { version: 'aes128gcm', privateKey: phone, authSecret }).toString())
    return new Response(null, { status: phoneStatus })
  }
  return realFetch(url, init)
}) as typeof fetch

await import('../backend/hera-nudge.ts')
const call = (body: unknown, headers: Record<string, string> = {}) => realFetch('http://localhost:8000', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body)
}).then(async r => ({ status: r.status, json: await r.json() }))

// Today in India, and a period that started 26 days ago => heads-up is due today (2 days before day 29).
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
const back = (n: number) => new Date(Date.parse(today) - n * 86400000).toISOString().slice(0, 10)

Deno.test('hera-nudge', async (t) => {
  db.hera_settings.push({ key: 'cron_secret', value: 's3cret' })
  db.profiles.push({ id: 'u1', name: 'Pran', life_stage: 'cycles', cycle_length: 28, cycle_length_known: true, period_length: 5,
    tone: 'bestie', timezone: 'Asia/Kolkata', nudge_time: '00:00', quiet_start: '00:00', quiet_end: '00:00', checkin_day: 9, podcast_picks: false, onboarded_at: 'x' })
  db.cycle_logs.push({ user_id: 'u1', log_date: back(26), kind: 'period_start' })
  db.push_subscriptions.push({ id: 900, user_id: 'u1', endpoint: 'https://push.example/1',
    p256dh: phone.getPublicKey('base64url'), auth: authSecret.toString('base64url') })
  // Her partner Arjun, with notifications on
  db.partner_links.push({ id: 50, owner_id: 'u1', invite_code: 'abcdefghij12', partner_id: 'p1', partner_name: 'Arjun',
    notify_heads_up: true, notify_tips: true, notify_crisis: true })
  db.push_subscriptions.push({ id: 901, user_id: 'p1', endpoint: 'https://push.example/2',
    p256dh: phone.getPublicKey('base64url'), auth: authSecret.toString('base64url') })

  await t.step('creates and keeps notification keys', async () => {
    const a = await call({ action: 'public_key' }); const b = await call({ action: 'public_key' })
    assert(a.json.publicKey.length > 80); eq(a.json.publicKey, b.json.publicKey)
  })
  await t.step('refuses runs without the schedule secret', async () => {
    eq((await call({ action: 'run' })).status, 403)
    eq((await call({ action: 'run' }, { 'x-cron-secret': 'nope' })).status, 403)
  })
  await t.step('sends the due reminder to her phone and chat', async () => {
    const r = await call({ action: 'run' }, { 'x-cron-secret': 's3cret' })
    eq(r.json, { checked: 1, phones: 2, sent: 1, delivered: 1, partners: 1, failed: 0, refused: [] })
    eq(pushes.length, 2)
    const payload = JSON.parse(pushes[0]); eq(payload.title, 'Your day at a glance'); eq(payload.tag, 'period_heads_up')
    assert(payload.body.startsWith('Hey Pran!'), payload.body)
    eq(db.messages.length, 1); eq(db.messages[0].role, 'hera')
  })
  await t.step('her partner gets their own heads-up, not her chat', async () => {
    const p = JSON.parse(pushes[1]); eq(p.tag, 'partner_heads_up')
    assert(p.body.startsWith("Heads-up: Pran's period"), p.body)
    eq(db.messages.length, 1) // nothing added to anyone's chat for the partner
    eq(db.nudges_sent.map((n: any) => `${n.user_id}:${n.kind}`), ['u1:period_heads_up', 'p1:partner_heads_up'])
  })
  await t.step('does not repeat it on the next run', async () => {
    const r = await call({ action: 'run' }, { 'x-cron-secret': 's3cret' })
    eq(r.json.sent, 0); eq(r.json.partners, 0); eq(pushes.length, 2)
  })
  await t.step('partner screen shows only her name, phase and a tip', async () => {
    const r = await call({ action: 'partner_view' }, { Authorization: 'Bearer partner' })
    eq(Object.keys(r.json).sort(), ['about', 'her_name', 'linked', 'next_period', 'nudges', 'period_now', 'phase', 'phase_label', 'tip'])
    eq(r.json.next_period.from <= r.json.next_period.to, true) // shared by default
    eq(r.json.period_now, null)
    eq(r.json.her_name, 'Pran'); eq(r.json.phase, 'pms'); eq(r.json.phase_label, 'PMS days')
    eq((await call({ action: 'partner_view' }, { Authorization: 'Bearer good' })).json, { linked: false })
    db.partner_links[0].share_dates = false
    const hidden = await call({ action: 'partner_view' }, { Authorization: 'Bearer partner' })
    eq(hidden.json.next_period, null); eq(hidden.json.nudges.dates, false)
    db.partner_links[0].share_dates = true
    eq((await call({ action: 'partner_view' }, { Authorization: 'Bearer bad' })).status, 401)
  })
  await t.step('crisis alert reaches the partner once, then rests for 3 hours', async () => {
    const a = await call({ action: 'crisis' }, { Authorization: 'Bearer good' })
    eq(a.json, { alerted: true, partner_name: 'Arjun' })
    const p = JSON.parse(pushes.at(-1)!); eq(p.tag, 'partner_crisis')
    assert(p.body.includes('Pran is having a really hard time'), p.body)
    const before = pushes.length
    eq((await call({ action: 'crisis' }, { Authorization: 'Bearer good' })).json.alerted, true)
    eq(pushes.length, before)
    // A partner can't trigger an alert about themselves
    eq((await call({ action: 'crisis' }, { Authorization: 'Bearer partner' })).json, { alerted: false })
  })
  await t.step('no crisis alert when she switched it off', async () => {
    db.partner_links[0].notify_crisis = false
    db.nudges_sent = db.nudges_sent.filter((n: any) => n.kind !== 'partner_crisis')
    eq((await call({ action: 'crisis' }, { Authorization: 'Bearer good' })).json, { alerted: false })
  })
  await t.step('test notification for a signed-in user', async () => {
    const r = await call({ action: 'test' }, { Authorization: 'Bearer good' })
    eq(r.json, { devices: 1, delivered: 1, refused: [] }); assert(pushes.at(-1)!.includes('how my reminders will look'))
    eq((await call({ action: 'test' }, { Authorization: 'Bearer bad' })).status, 401)
  })
  await t.step('delete account removes her login and everything linked to it', async () => {
    eq((await call({ action: 'delete_account' }, { Authorization: 'Bearer bad' })).status, 401)
    db.messages.push({ user_id: 'p1', role: 'hera', content: 'partner-side row' })
    const r = await call({ action: 'delete_account' }, { Authorization: 'Bearer partner' })
    eq(r.json, { deleted: true }); eq(deletedUsers, ['p1'])
    eq(db.partner_links.length, 0); eq(db.messages.some((m: any) => m.user_id === 'p1'), false)
    eq(db.profiles.length, 1) // her data untouched
  })
  await t.step('forgets a phone that unsubscribed', async () => {
    phoneStatus = 410
    await call({ action: 'test' }, { Authorization: 'Bearer good' })
    eq(db.push_subscriptions.filter((s: any) => s.user_id === 'u1').length, 0)
  })

  await t.step("one person's error doesn't stop everyone else's reminders", async () => {
    // Meera's profile is broken in a way that crashes her check; Divya's is fine and due today.
    for (const id of ['u2', 'u3']) {
      db.profiles.push({ id, name: id === 'u2' ? 'Meera' : 'Divya', life_stage: 'cycles', cycle_length: 28, cycle_length_known: true, period_length: 5,
        tone: 'bestie', timezone: 'Asia/Kolkata', nudge_time: '00:00', quiet_start: '00:00', quiet_end: '00:00', checkin_day: 9, podcast_picks: false, onboarded_at: 'x' })
      db.cycle_logs.push({ user_id: id, log_date: back(26), kind: 'period_start' })
      db.push_subscriptions.push({ id: id === 'u2' ? 902 : 903, user_id: id, endpoint: 'https://push.example/' + id,
        p256dh: phone.getPublicKey('base64url'), auth: authSecret.toString('base64url') })
    }
    Object.defineProperty(db.profiles.find((p: { id: string }) => p.id === 'u2'), 'name', { get() { throw new Error('broken profile') } })
    const before = pushes.length
    const r = await call({ action: 'run' }, { 'x-cron-secret': 's3cret' })
    eq(r.status, 200)
    eq(r.json.failed, 1)
    eq(r.json.sent, 1)
    assert(pushes.slice(before).some(p => p.includes('Divya')), 'Divya still got her reminder')
  })

  await t.step("a phone's push service refusing is reported, not hidden", async () => {
    db.profiles.push({ id: 'u4', name: 'Asha', life_stage: 'cycles', cycle_length: 28, cycle_length_known: true, period_length: 5,
      tone: 'bestie', timezone: 'Asia/Kolkata', nudge_time: '00:00', quiet_start: '00:00', quiet_end: '00:00', checkin_day: 9, podcast_picks: false, onboarded_at: 'x' })
    db.cycle_logs.push({ user_id: 'u4', log_date: back(26), kind: 'period_start' })
    db.push_subscriptions.push({ id: 904, user_id: 'u4', endpoint: 'https://push.example/u4',
      p256dh: phone.getPublicKey('base64url'), auth: authSecret.toString('base64url') })
    phoneStatus = 403
    const r = await call({ action: 'run' }, { 'x-cron-secret': 's3cret' })
    phoneStatus = 201
    eq(r.json.sent, 1)
    eq(r.json.delivered, 0)
    assert(r.json.refused.some((x: string) => x.startsWith('push.example 403')), JSON.stringify(r.json.refused))
    assert(db.push_subscriptions.some((s: { id: number }) => s.id === 904), 'a refusal keeps the subscription')
  })

  await t.step('9 am report goes to Pran once, with counts only', async () => {
    db.hera_settings.push({ key: 'report_to', value: 'u4' }) // Asha's phone is still signed up
    const before = pushes.length
    // 8:45 India time: no report yet
    Deno.env.set('HERA_TEST_NOW', today + 'T03:15:00Z')
    let r = await call({ action: 'run' }, { 'x-cron-secret': 's3cret' })
    assert(!r.json.report, 'no report before 9')
    // 9:00 India time: the report
    Deno.env.set('HERA_TEST_NOW', today + 'T03:30:00Z')
    r = await call({ action: 'run' }, { 'x-cron-secret': 's3cret' })
    assert(r.json.report, 'report at 9')
    const m = r.json.report.match(/Reminders so far today: (\d+) of (\d+) people/)
    assert(m && Number(m[1]) <= Number(m[2]), r.json.report)
    assert(/Reached \d+ of \d+ phones/.test(r.json.report), r.json.report)
    const sentNow = pushes.slice(before).filter(p => p.includes('9 am report'))
    eq(sentNow.length, 1)
    assert(!/Pran|Divya|Asha|Meera/.test(r.json.report), 'no names in the report')
    // 9:15 run the same day: not again
    Deno.env.set('HERA_TEST_NOW', today + 'T03:44:00Z')
    r = await call({ action: 'run' }, { 'x-cron-secret': 's3cret' })
    assert(!r.json.report, 'only once a day')
    Deno.env.delete('HERA_TEST_NOW')
  })

  await t.step('broadcast: personalised, once a day, secret required', async () => {
    eq((await call({ action: 'broadcast', text: 'Hi {name}' })).status, 403)
    const before = pushes.length
    const msg = 'Good morning, {name}! ☀️ How are you really doing? 💜'
    const r = await call({ action: 'broadcast', text: msg }, { 'x-cron-secret': 's3cret' })
    eq(r.status, 200)
    assert(r.json.people >= 1, JSON.stringify(r.json)) // Meera's deliberately broken profile is skipped
    const got = pushes.slice(before)
    assert(got.some(p => p.includes('Good morning, Asha!')), 'name filled in')
    assert(!got.some(p => p.includes('{name}')), 'no raw placeholder')
    assert(db.messages.some((m: { user_id: string; content: string }) => m.user_id === 'u4' && m.content.startsWith('Good morning, Asha!')), 'in her chat')
    const again = await call({ action: 'broadcast', text: msg }, { 'x-cron-secret': 's3cret' })
    eq(again.json.people, 0)
    assert(again.json.already_sent_today >= r.json.people, 'nobody is sent twice')
  })
})
