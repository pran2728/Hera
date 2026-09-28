import { Logo } from '../App.jsx'

// Shown instead of a blank screen when Vercel is missing the Supabase values.
export default function SetupNeeded() {
  return (
    <main className="center-page">
      <Logo size={64} />
      <h1>Hera needs one more setup step</h1>
      <p className="muted">
        The Supabase values aren't set. In Vercel, open Settings → Environment Variables and add
        <code> VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, then redeploy.
      </p>
    </main>
  )
}
