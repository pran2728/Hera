import { useEffect, useState } from 'react'
import { supabase, isConfigured } from './lib/supabase'
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
  const userId = session.user.id

  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle().then(({ data, error }) => {
      if (error) {
        // The tables don't exist yet: database.sql hasn't been run in Supabase.
        if (/does not exist|could not find the table|schema cache/i.test(error.message)) setDbMissing(true)
        else console.error(error)
        setProfile(null)
        return
      }
      setProfile(data)
    })
  }, [userId])

  if (dbMissing) return <DatabaseMissing />
  if (profile === undefined) return <Splash />
  if (!profile?.onboarded_at) return <Onboarding session={session} onDone={setProfile} />
  return <Chat session={session} profile={profile} />
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
