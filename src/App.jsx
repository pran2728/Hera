import { useEffect, useState } from 'react'
import { supabase, isConfigured } from './lib/supabase'
import Login from './screens/Login.jsx'
import Home from './screens/Home.jsx'
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
  if (session === undefined) return <div className="splash"><Logo size={72} /></div>
  return session ? <Home session={session} /> : <Login />
}

export function Logo({ size = 48 }) {
  return <img src="/icon.svg" width={size} height={size} alt="Hera" className="logo" />
}
