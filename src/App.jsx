import { useEffect, useState } from 'react'
import { supabase, isConfigured, withRetry, isNetworkError, diagnose } from './lib/supabase'
import Login from './screens/Login.jsx'
import Onboarding from './screens/Onboarding.jsx'
import Chat from './screens/Chat.jsx'
import SetupNeeded from './screens/SetupNeeded.jsx'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = still checking

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isConfigured) return <SetupNeeded />
  if (session === undefined) return <Splash />
  if (!session) return <Login />
  return <SignedIn session={session} />
}

function SignedIn({ session }) {
  const [profile, setProfile] = useState(undefined)
  const [dbMissing, setDbMissing] = useState(false)
  const [offline, setOffline] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const userId = session.user.id

  useEffect(() => {
    setOffline(null)
    withRetry(() => supabase.from('profiles').select('*').eq('id', userId).maybeSingle()).then(async ({ data, error }) => {
      if (error) {
        // The tables don't exist yet: database.sql hasn't been run in Supabase.
        if (/does not exist|could not find the table|schema cache/i.test(error.message)) { setDbMissing(true); setProfile(null); return }
        // Can't reach the database: say so instead of starting onboarding again.
        setOffline(isNetworkError(error) ? await diagnose() : error.message)
        return
      }
      setProfile(data)
    })
  }, [userId, attempt])

  if (dbMissing) return <DatabaseMissing />
  if (offline) return <CantConnect details={offline} onRetry={() => setAttempt(a => a + 1)} />
  if (profile === undefined) return <Splash />
  if (!profile?.onboarded_at) return <Onboarding session={session} onDone={setProfile} />
  return <Chat session={session} profile={profile} onProfileChange={setProfile}
               onDeleted={() => setProfile(null)} />
}

function CantConnect({ details, onRetry }) {
  return (
    <main className="center-page">
      <Logo size={64} />
      <h1>I can't reach my memory right now</h1>
      <p className="muted">Check your internet and try again. If it keeps happening, send a screenshot of this screen.</p>
      <pre className="details">{details}</pre>
      <button className="primary" onClick={onRetry}>Try again</button>
      <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </main>
  )
}

function Splash() {
  return <div className="splash"><Logo size={72} /></div>
}

function DatabaseMissing() {
  return (
    <main className="center-page">
      <Logo size={64} />
      <h1>Hera's memory isn't set up yet</h1>
      <p className="muted">
        Run <code>backend/database.sql</code> in Supabase → SQL Editor, then reopen Hera.
      </p>
      <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
    </main>
  )
}

export function Logo({ size = 48 }) {
  return <img src="/icon.svg" width={size} height={size} alt="Hera" className="logo" />
}
