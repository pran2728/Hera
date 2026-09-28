// In-memory stand-in for supabase-js, enough for hera-chat.
/** @type {Record<string, any[]>} */
export const db = { profiles: [], messages: [], cycle_logs: [] }
let nextId = 1
class Q {
  constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.ord = null; this.lim = null; this.single = false }
  select() { return this }
  eq(c, v) { this.f.push(r => r[c] === v); return this }
  gte(c, v) { this.f.push(r => r[c] >= v); return this }
  lte(c, v) { this.f.push(r => r[c] <= v); return this }
  order(c, { ascending }) { this.ord = [c, ascending]; return this }
  limit(n) { this.lim = n; return this }
  maybeSingle() { this.single = true; return this }
  insert(o) { this.op = 'insert'; this.row = o; return this }
  delete() { this.op = 'delete'; return this }
  update(o) { this.op = 'update'; this.row = o; return this }
  then(res, rej) { return Promise.resolve(this.run()).then(res, rej) }
  run() {
    const rows = db[this.t]; const match = r => this.f.every(f => f(r))
    if (this.op === 'insert') { rows.push({ id: nextId++, created_at: new Date(Date.now() + nextId).toISOString(), ...this.row }); return { error: null } }
    if (this.op === 'delete') { db[this.t] = rows.filter(r => !match(r)); return { error: null } }
    if (this.op === 'update') { rows.filter(match).forEach(r => Object.assign(r, this.row)); return { error: null } }
    let out = rows.filter(match)
    if (this.ord) { const [c, asc] = this.ord; out = [...out].sort((a, b) => (a[c] > b[c] ? 1 : -1) * (asc ? 1 : -1)) }
    if (this.lim) out = out.slice(0, this.lim)
    return { data: this.single ? (out[0] ?? null) : out, error: null }
  }
}
export function createClient(_u, _k, opts) {
  const auth = opts?.global?.headers?.Authorization
  return {
    auth: { getUser: async () => auth === 'Bearer good' ? { data: { user: { id: 'u1' } }, error: null } : { data: null, error: 'bad' } },
    from: t => new Q(t)
  }
}
