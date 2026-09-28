import { Logo } from '../App.jsx'
import { configProblem } from '../lib/supabase'

// Shown instead of a broken app when Vercel's Supabase values are missing or wrong.
export default function SetupNeeded() {
  return (
    <main className="center-page">
      <Logo size={64} />
      <h1>Hera needs one more setup step</h1>
      <p className="muted">
        {configProblem === 'placeholder'
          ? "The Supabase values in Vercel look like placeholders or have a typo. "
          : "The Supabase values aren't set in Vercel. "}
        In Vercel, open Settings → Environment Variables and set
        <code> VITE_SUPABASE_URL</code> (like https://abcd.supabase.co) and
        <code> VITE_SUPABASE_PUBLISHABLE_KEY</code>. Then open Deployments and Redeploy.
      </p>
    </main>
  )
}
