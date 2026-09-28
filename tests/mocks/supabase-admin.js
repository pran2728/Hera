// In-memory stand-in for supabase-js, enough for hera-nudge.
export const db = { profiles: [], messages: [], cycle_logs: [], push_subscriptions: [], nudges_sent: [], hera_settings: [] }
const KEYS = { hera_settings: ['key'], nudges_sent: ['user_id', 'kind', 'for_date'] }
let nextId = 1
class Q {
  constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.single = false }
  select() { return this }
  eq(c, v) { this.f.push(r => r[c] === v); return this }
  in(c, vs) { this.f.push(r => vs.includes(r[c])); return this }
  gte(c, v) { this.f.push(r => r[c] >= v); return this }
  not(c, op, v) { this.f.push(r => !(op === 'is' && v === null ? r[c] == null : r[c] === v)); return this }
  maybeSingle() { this.single = true; return this }
  insert(o) { this.op = 'insert'; this.rows = Array.isArray(o) ? o : [o]; return this }
  delete() { this.op = 'delete'; return this }
  then(res, rej) { return Promise.resolve(this.run()).then(res, rej) }
  run() {
    const match = r => this.f.every(f => f(r))
    if (this.op === 'insert') {
      const key = KEYS[this.t]
      for (const row of this.rows) {
        if (key && db[this.t].some(r => key.every(k => r[k] === row[k]))) return { error: { code: '23505', message: 'duplicate key' } }
      }
      for (const row of this.rows) db[this.t].push({ id: nextId++, ...row })
      return { error: null }
    }
    if (this.op === 'delete') { db[this.t] = db[this.t].filter(r => !match(r)); return { error: null } }
    const out = db[this.t].filter(match)
    return { data: this.single ? (out[0] ?? null) : out, error: null }
  }
}
export function createClient(_u, _k, opts) {
  const auth = opts?.global?.headers?.Authorization
  return {
    auth: { getUser: async () => auth === 'Bearer good' ? { data: { user: { id: 'u1' } } } : { data: { user: null } } },
    from: t => new Q(t)
  }
}
