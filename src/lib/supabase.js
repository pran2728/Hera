import { createClient } from '@supabase/supabase-js'

// These two values are public by design (they ship inside every Supabase app).
// Secret keys, like the Gemini API key, never live in this code.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isConfigured = Boolean(url && key)

export const supabase = isConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null
