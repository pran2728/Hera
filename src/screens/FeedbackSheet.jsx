import { useState } from 'react'
import { supabase } from '../lib/supabase'

const ABOUT_REPLY = [['wrong_info', 'Wrong or unsafe info'], ['wrong_log', 'Logged something wrong'], ['tone', "Tone didn't feel right"], ['other', 'Something else']]
const GENERAL = [['bug', 'Something is broken'], ['idea', 'An idea'], ['wrong_info', 'Wrong health info'], ['other', 'Something else']]

// "Something wrong?" — about one reply, or general feedback from My profile.
export default function FeedbackSheet({ reply, onClose }) {
  const options = reply ? ABOUT_REPLY : GENERAL
  const [category, setCategory] = useState(null)
  const [note, setNote] = useState('')
  const [state, setState] = useState('') // '', 'sending', 'sent', error text

  async function send(e) {
    e.preventDefault()
    setState('sending')
    const { error } = await supabase.from('feedback').insert({ category, hera_reply: reply?.slice(0, 2000) ?? null, note: note.trim().slice(0, 1000) || null })
    setState(error ? (/schema cache|does not exist/i.test(error.message) ? 'Feedback needs a database update (run database.sql again).' : "Couldn't send. Try again?") : 'sent')
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" onClick={e => e.stopPropagation()} onSubmit={send} role="dialog" aria-label="Send feedback">
        {state === 'sent'
          ? <>
              <h2>Thank you 💜</h2>
              <p className="muted small">This helps make Hera better and safer.</p>
              <button type="button" className="primary" onClick={onClose}>Done</button>
            </>
          : <>
              <h2>{reply ? "What's wrong with this reply?" : 'Send feedback'}</h2>
              {reply && <blockquote className="quoted">{reply.length > 160 ? reply.slice(0, 160) + '…' : reply}</blockquote>}
              <div className="chip-row">
                {options.map(([v, label]) => (
                  <button key={v} type="button" className={`chip ${category === v ? 'on' : ''}`} aria-pressed={category === v} onClick={() => setCategory(v)}>{label}</button>
                ))}
              </div>
              <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} maxLength={1000}
                        placeholder={reply ? 'What should she have said? (optional)' : 'Tell us more (optional)'} />
              {state && state !== 'sending' && <p className="error" role="alert">{state}</p>}
              <div className="btn-row">
                <button className="primary" disabled={!category || state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send'}</button>
                <button type="button" className="link" onClick={onClose}>Cancel</button>
              </div>
            </>}
      </form>
    </div>
  )
}
