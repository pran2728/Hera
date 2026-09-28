import { createClient } from '@supabase/supabase-js'

// These two values are public by design (they ship inside every Supabase app).
// Secret keys, like the Gemini API key, never live in this code.
// Trim stray spaces and a trailing slash, which are easy to paste by accident.
const url = (import.meta.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '')
const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim()

// Treat the placeholder values from .env.example as "not set".
const looksReal = /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) &&
  !url.includes('your-project') && key.length > 20 && !key.startsWith('your-')

export const isConfigured = looksReal
export const supabaseUrl = url
export const supabaseKey = key
export const configProblem = !url || !key
  ? 'missing'
  : !looksReal ? 'placeholder' : null

export const supabase = isConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null

export function isNetworkError(err) {
  return /load failed|failed to fetch|networkerror|network request failed|typeerror/i.test(String(err?.message ?? err ?? ''))
}

// Retry a Supabase call a few times when the phone's connection blips.
export async function withRetry(fn, tries = 3) {
  let last
  for (let i = 0; i < tries; i++) {
    last = await fn()
    if (!last.error || !isNetworkError(last.error)) return last
    await new Promise(r => setTimeout(r, 800 * (i + 1)))
  }
  return last
}

// Plain-English check of which part of Supabase can't be reached.
export async function diagnose() {
  const lines = []
  const check = async (label, path, headers) => {
    try {
      const r = await fetch(supabaseUrl + path, { headers })
      if (r.ok) return lines.push(`${label}: OK`)
      let detail = ''
      try { detail = (await r.json()).message || '' } catch { /* not JSON */ }
      lines.push(`${label}: error ${r.status}${detail ? ` (${detail.slice(0, 80)})` : ''}`)
    } catch (e) {
      lines.push(`${label}: can't connect (${e.message})`)
    }
  }
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  await check('Login server', '/auth/v1/health', { apikey: supabaseKey })
  await check('Database', '/rest/v1/profiles?select=id&limit=1',
    { apikey: supabaseKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) })
  return lines.join('\n')
}
