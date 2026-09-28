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
export const configProblem = !url || !key
  ? 'missing'
  : !looksReal ? 'placeholder' : null

export const supabase = isConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null
