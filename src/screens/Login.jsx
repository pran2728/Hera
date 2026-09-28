import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Logo } from '../App.jsx'

// Email + password login. Chosen over magic links because a link opened
// from email lands in the browser, not in the installed home-screen app on iPhone.
export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(e) {
    e.preventDefault()
    setError(''); setNotice(''); setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin }
        })
        if (error) throw error
        if (!data.session) {
          setNotice("Check your inbox, babe! Tap the link in the email to confirm, then come back here and sign in.")
          setMode('signin')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (err) {
      setError(friendly(err.message))
    } finally {
      setBusy(false)
    }
  }

  async function forgot() {
    setError(''); setNotice('')
    if (!email) { setError('Type your email first, then tap "Forgot password".'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (error) setError(friendly(error.message))
    else setNotice('Sent! Check your email for a reset link.')
  }

  return (
    <main className="center-page">
      <Logo size={72} />
      <h1 className="brand">Hera</h1>
      <p className="tagline">Your cycle companion. Just talk to her.</p>

      <form className="card" onSubmit={submit}>
        <h2>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
        <label>
          Email
          <input type="email" autoComplete="email" required value={email}
                 onChange={e => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" required minLength={8}
                 autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                 value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        {mode === 'signup' && <p className="hint">At least 8 characters.</p>}

        {error && <p className="error" role="alert">{error}</p>}
        {notice && <p className="notice" role="status">{notice}</p>}

        <button className="primary" disabled={busy}>
          {busy ? 'One sec…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
        </button>

        {mode === 'signin' && (
          <button type="button" className="link" onClick={forgot}>Forgot password?</button>
        )}
      </form>

      <p className="switch">
        {mode === 'signin' ? "New to Hera? " : 'Already have an account? '}
        <button type="button" className="link"
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setNotice('') }}>
          {mode === 'signin' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
    </main>
  )
}

function friendly(msg = '') {
  if (/invalid login/i.test(msg)) return "That email and password don't match. Try again?"
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox (and spam).'
  if (/already registered/i.test(msg)) return 'You already have an account. Sign in instead.'
  if (/rate limit/i.test(msg)) return 'Too many emails sent. Wait a few minutes and try again.'
  return msg || 'Something went wrong. Try again?'
}
