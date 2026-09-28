import { db } from './mocks/supabase-admin.js'
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
    tone: 'bestie', timezone: 'Asia/Kolkata', nudge_time: '00:00', quiet_start: '00:00', quiet_end: '00:00', checkin_day: 9, onboarded_at: 'x' })
  db.cycle_logs.push({ user_id: 'u1', log_date: back(26), kind: 'period_start' })
  db.push_subscriptions.push({ id: 900, user_id: 'u1', endpoint: 'https://push.example/1',
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
    eq(r.json, { checked: 1, sent: 1 })
    eq(pushes.length, 1)
    const payload = JSON.parse(pushes[0]); eq(payload.title, 'Hera'); eq(payload.tag, 'period_heads_up')
    assert(payload.body.startsWith('Hey Pran!'), payload.body)
    eq(db.messages.length, 1); eq(db.messages[0].role, 'hera')
    eq(db.nudges_sent.map((n: any) => n.kind), ['period_heads_up'])
  })
  await t.step('does not repeat it on the next run', async () => {
    const r = await call({ action: 'run' }, { 'x-cron-secret': 's3cret' })
    eq(r.json.sent, 0); eq(pushes.length, 1)
  })
  await t.step('test notification for a signed-in user', async () => {
    const r = await call({ action: 'test' }, { Authorization: 'Bearer good' })
    eq(r.json, { devices: 1, delivered: 1 }); assert(pushes.at(-1)!.includes('how my reminders will look'))
    eq((await call({ action: 'test' }, { Authorization: 'Bearer bad' })).status, 401)
  })
  await t.step('forgets a phone that unsubscribed', async () => {
    phoneStatus = 410
    await call({ action: 'test' }, { Authorization: 'Bearer good' })
    eq(db.push_subscriptions.length, 0)
  })
})
