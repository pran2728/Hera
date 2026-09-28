import { supabase } from '../lib/supabase'
import { Logo } from '../App.jsx'

// Stage 9a: the chat screen's shell. Real conversation arrives in stage 9c.
export default function Home({ session }) {
  const email = session.user.email

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand"><Logo size={32} /><span>Hera</span></div>
        <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>

      <main className="chat">
        <div className="bubble hera">
          Hey babe! 💜 I'm Hera. You're signed in as <strong>{email}</strong>.
        </div>
        <div className="bubble hera">
          I'm still getting ready. Soon you'll just tell me things like
          "got my period this morning" and I'll handle the rest.
        </div>
      </main>

      <form className="composer" onSubmit={e => e.preventDefault()}>
        <input disabled placeholder="Chat opens in the next update…" aria-label="Message Hera" />
        <button className="primary" disabled>Send</button>
      </form>
    </div>
  )
}
