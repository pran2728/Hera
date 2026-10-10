import { db } from './mocks/supabase.js'
function assert(c: unknown, m = 'assertion failed') { if (!c) throw new Error(m) }
function assertEquals(a: unknown, b: unknown) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`)
}

Deno.env.set('SUPABASE_URL', 'http://x'); Deno.env.set('GEMINI_API_KEY', 'k')
const realFetch = globalThis.fetch
let nextAI: unknown = null; let lastAIBody: any = null; let aiStatus = 200; let busyModels: string[] = []; const modelsTried: string[] = []
globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
  if (String(url).includes('/v1beta/models?')) {
    return new Response(JSON.stringify({ models: [
      { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-4.0-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-4.0-flash-lite', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-4.0-flash-image', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] }
    ] }))
  }
  if (String(url).includes('googleapis')) {
    lastAIBody = JSON.parse(String(init?.body))
    const model = String(url).split('/models/')[1].split(':')[0]; modelsTried.push(model)
    if (busyModels.includes(model)) return new Response('{"error":{"code":503,"message":"high demand"}}', { status: 503 })
    if (aiStatus !== 200) return new Response('rate', { status: aiStatus })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(nextAI) }] } }] }))
  }
  if (String(url) === 'http://x/functions/v1/hera-nudge') {
    partnerCalls.push({ auth: (init?.headers as Record<string, string>).Authorization, body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify({ alerted: true, partner_name: 'Arjun' }))
  }
  return realFetch(url, init)
}) as typeof fetch
const partnerCalls: any[] = []

await import('../backend/hera-chat.ts')
const call = (body: unknown, auth = 'Bearer good') => realFetch('http://localhost:8000', {
  method: 'POST', headers: { Authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify(body)
}).then(async r => ({ status: r.status, json: await r.json() }))

Deno.test('rejects signed-out users', async () => {
  assertEquals((await call({ message: 'hi' }, 'Bearer nope')).status, 401)
})

Deno.test('asks for onboarding first', async () => {
  assertEquals((await call({ message: 'hi', today: '2026-09-28' })).json.error, 'onboarding_needed')
})

Deno.test('full flow', async (t) => {
  db.profiles.push({ id: 'u1', name: 'Pranathi', life_stage: 'cycles', cycle_length: 28, cycle_length_known: true,
    period_length: 5, diet: 'vegetarian', tone: 'bestie', conditions: [], onboarded_at: 'x', last_period_start: '2026-08-31',
    age: 27, favourite_foods: 'dosa, dark chocolate', activity_level: 'light', goals: ['Sleep better'], about_me: 'I work night shifts' })

  await t.step('logs a period start and replies', async () => {
    nextAI = { reply: 'Oh hey babe! Got it, period started today, Mon 28 Sep.', logs: [{ kind: 'period_start', date: '2026-09-28' }], safety_level: 'none' }
    const r = await call({ message: 'hey got my periods this morning', today: '2026-09-28' })
    assertEquals(r.status, 200)
    assertEquals(r.json.logged.length, 1)
    assertEquals(r.json.cycle.phase, 'menstrual'); assertEquals(r.json.cycle.day, 1)
    assertEquals(db.profiles[0].last_period_start, '2026-09-28')
    assertEquals(db.messages.length, 2)
    // prompt carries her context
    const sys = lastAIBody.systemInstruction.parts[0].text
    assert(sys.includes('Vegetarian')); assert(sys.includes('Mon 28 Sep')); assert(sys.includes('babe'))
    assert(sys.includes('Age: 27')); assert(sys.includes('dosa, dark chocolate')); assert(sys.includes('lightly active'))
    assert(sys.includes('Sleep better')); assert(sys.includes('night shifts'))
    assertEquals(lastAIBody.contents.at(-1).role, 'user')
  })

  await t.step('correction replaces the date, no duplicates', async () => {
    nextAI = { reply: 'Fixed!', logs: [{ kind: 'period_start', date: '2026-09-27', replace_previous: true }], safety_level: 'none' }
    const r = await call({ message: 'actually it started yesterday', today: '2026-09-28' })
    const starts = db.cycle_logs.filter((l: any) => l.kind === 'period_start')
    assertEquals(starts.map((s: any) => s.log_date), ['2026-09-27'])
    assertEquals(r.json.cycle.day, 2)
  })

  await t.step('pain + mood, rejects future and bad kinds', async () => {
    nextAI = { reply: 'Noted', logs: [
      { kind: 'pain', date: '2026-09-28', value: '6' }, { kind: 'energy', date: '2026-09-28', value: 'low' },
      { kind: 'pain', date: '2026-10-05', value: '2' }, { kind: 'hack', date: '2026-09-28' }], safety_level: 'none' }
    const r = await call({ message: 'cramps 6 and exhausted', today: '2026-09-28' })
    assertEquals(r.json.logged.map((l: any) => l.kind), ['pain', 'energy'])
  })

  await t.step('crisis reply always carries the helpline', async () => {
    nextAI = { reply: "I'm really glad you told me.", logs: [], safety_level: 'danger' }
    const r = await call({ message: 'i dont see the point anymore', today: '2026-09-28' })
    assert(r.json.reply.includes('14416'))
    // Her partner is asked to check on her, as her, without what she said
    assertEquals(r.json.partner_alerted, 'Arjun')
    assertEquals(partnerCalls.length, 1)
    assertEquals(partnerCalls[0].body, { action: 'crisis' })
  })

  await t.step('status action', async () => {
    const r = await call({ action: 'status', today: '2026-10-01' })
    assertEquals(r.json.cycle.day, 5)
  })

  await t.step('rate limit gives a friendly reply', async () => {
    aiStatus = 429
    const r = await call({ message: 'hi', today: '2026-09-28' })
    assert(r.json.reply.includes('minute')); aiStatus = 200
  })

  await t.step('rate limit reply includes a detail line', async () => {
    aiStatus = 500
    const r = await call({ message: 'hi', today: '2026-09-28' })
    assert(String(r.json.detail).startsWith('500')); aiStatus = 200
  })

  await t.step('she can rename herself from chat', async () => {
    nextAI = { reply: 'Got it, Pran!', logs: [], safety_level: 'none', profile_updates: { name: 'Pran 💜' } }
    await call({ message: 'my name is Pran', today: '2026-09-28' })
    assertEquals(db.profiles[0].name, 'Pran')
  })

  await t.step('switches to trying-to-conceive from chat', async () => {
    nextAI = { reply: 'Ooh exciting! Switched you to trying-to-conceive mode 💜', logs: [], safety_level: 'none', profile_updates: { life_stage: 'ttc' } }
    const r = await call({ message: "we're trying for a baby now!", today: '2026-09-28' })
    assertEquals(r.json.profile_changes, { life_stage: 'ttc', ttc_since: '2026-09-28' })
    assertEquals(db.profiles[0].life_stage, 'ttc')
    // next prompt knows the mode, and lists only trusted links
    nextAI = { reply: 'ok', logs: [], safety_level: 'none' }
    await call({ message: 'when am I fertile?', today: '2026-09-28' })
    const sys = lastAIBody.systemInstruction.parts[0].text
    assert(sys.includes('Life stage: trying-to-conceive mode'), 'mode in prompt')
    assert(sys.includes('Trying to conceive for about 0 months. Estimated fertile window'), 'ttc details')
    assert(sys.includes('https://www.nhs.uk/pregnancy/trying-for-a-baby/'), 'sources listed')
  })

  await t.step('pregnant with a due date: week in the reply data and prompt', async () => {
    nextAI = { reply: 'Congratulations!!', logs: [], safety_level: 'none', profile_updates: { life_stage: 'pregnant', due_date: '2027-05-20' } }
    const r = await call({ message: 'I got a positive test! due 20 May', today: '2026-09-28' })
    assertEquals(r.json.profile_changes, { life_stage: 'pregnant', due_date: '2027-05-20' })
    assertEquals(r.json.cycle.mode, 'pregnant'); assertEquals(r.json.cycle.pregnancy.week, 6)
    nextAI = { reply: 'ok', logs: [], safety_level: 'none' }
    await call({ message: 'what should I eat', today: '2026-09-28' })
    const sys = lastAIBody.systemInstruction.parts[0].text
    assert(sys.includes('She is pregnant: 6 weeks'), 'week in prompt')
    assert(sys.includes('Baby is about the size of a masoor dal grain'), 'size in prompt')
  })

  await t.step('ignores odd changes from the AI', async () => {
    nextAI = { reply: 'ok', logs: [], safety_level: 'none', profile_updates: { life_stage: 'alien', due_date: '2031-01-01', trying_since: 'last year' } }
    const r = await call({ message: 'hmm', today: '2026-09-28' })
    assertEquals(r.json.profile_changes, {})
    assertEquals(db.profiles[0].life_stage, 'pregnant'); assertEquals(db.profiles[0].due_date, '2027-05-20')
  })

  await t.step('logs hot flushes and night sweats', async () => {
    db.profiles[0].life_stage = 'perimenopause'
    nextAI = { reply: 'Noted', logs: [{ kind: 'hot_flash', date: '2026-09-28', value: '3 times' }, { kind: 'night_sweat', date: '2026-09-27' }], safety_level: 'none' }
    const r = await call({ message: 'had 3 hot flushes today and night sweats last night', today: '2026-09-28' })
    assertEquals(r.json.logged.map((l: any) => l.kind), ['hot_flash', 'night_sweat'])
    nextAI = { reply: 'ok', logs: [], safety_level: 'none' }
    await call({ message: 'hi', today: '2026-09-28' })
    assert(lastAIBody.systemInstruction.parts[0].text.includes('hot flushes on 1 days; night sweats on 1 days'), 'symptoms in prompt')
    db.profiles[0].life_stage = 'cycles'
  })

  await t.step('busy model falls back to the next one', async () => {
    busyModels = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-4.0-flash']; modelsTried.length = 0
    nextAI = { reply: 'Hey babe, I got you', logs: [], safety_level: 'none' }
    const r = await call({ message: 'hi', today: '2026-09-28' })
    assertEquals(r.json.reply, 'Hey babe, I got you')
    // discovered models, newest first, image models skipped
    assertEquals(modelsTried, ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-4.0-flash', 'gemini-4.0-flash-lite'])
    busyModels = []
  })

  await t.step('history alternates and starts with user', async () => {
    nextAI = { reply: 'ok', logs: [], safety_level: 'none' }
    await call({ message: 'hello again', today: '2026-09-28' })
    const roles = lastAIBody.contents.map((c: any) => c.role)
    assertEquals(roles[0], 'user')
    for (let i = 1; i < roles.length; i++) assert(roles[i] !== roles[i - 1])
  })
})
