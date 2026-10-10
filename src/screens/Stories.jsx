import { useEffect, useRef, useState } from 'react'

const DURATION = 7000
const seenKey = today => `hera-stories-seen-${today}`

export function seenStories(today) {
  try { return JSON.parse(localStorage.getItem(seenKey(today)) || '[]') } catch { return [] }
}
function markSeen(today, key) {
  try {
    const s = new Set(seenStories(today)); s.add(key)
    localStorage.setItem(seenKey(today), JSON.stringify([...s]))
    // Tidy up older days.
    Object.keys(localStorage).filter(k => k.startsWith('hera-stories-seen-') && k !== seenKey(today)).forEach(k => localStorage.removeItem(k))
  } catch { /* private mode */ }
}

const ICONS = {
  body: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l2.5 2.5" /></>,
  plate: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /></>,
  move: <><circle cx="13" cy="4.5" r="1.8" /><path d="M7 21l3-6 3 2v4M10 15l1-5 4 2 2 3M11 10l-3 1-1 3" /></>,
  fact: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></>,
  checkin: <><path d="M20 12a8 8 0 1 1-3-6.2" /><path d="M9 12l2.5 2.5L20 6" /></>
}

// The row of story circles on Today.
export function StoryRow({ stories, today, onOpen, version }) {
  const seen = seenStories(today)
  return (
    <div className="story-row" role="list" aria-label="Today's stories" data-v={version}>
      {stories.map((s, i) => (
        <button key={s.key} type="button" role="listitem" className={`story-dot ${seen.includes(s.key) ? 'seen' : ''}`} onClick={() => onOpen(i)}
                aria-label={`${s.label}${seen.includes(s.key) ? ' (seen)' : ''}`}>
          <span className="story-ring"><span className={`story-face bg-${s.bg}`}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[s.key]}</svg>
          </span></span>
          <span className="story-label">{s.label}</span>
        </button>
      ))}
    </div>
  )
}

// Full-screen viewer: tap right for next, left for back, hold to pause, swipe down or × to close.
export function StoryViewer({ stories, start, today, onClose, onAnswer }) {
  const [i, setI] = useState(start)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [answered, setAnswered] = useState(null)
  const press = useRef(null) // { x, y, t } of the current touch
  const done = useRef(0) // progress of the current card, kept across pauses
  const s = stories[i]

  useEffect(() => { done.current = 0; markSeen(today, s.key); setProgress(0); setAnswered(null) }, [i])

  // Advance on a timer (not on the check-in card, which waits for an answer).
  useEffect(() => {
    if (paused || s.options) return
    const t0 = Date.now() - done.current * DURATION
    const id = setInterval(() => {
      const p = (Date.now() - t0) / DURATION
      done.current = p
      if (p >= 1) { clearInterval(id); next() } else setProgress(p)
    }, 50)
    return () => clearInterval(id)
  }, [i, paused])

  useEffect(() => {
    const onKey = e => { if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev(); else if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function next() { if (i < stories.length - 1) setI(i + 1); else onClose() }
  function prev() { if (i > 0) setI(i - 1); else setProgress(0) }

  async function answer([label, kind, value]) {
    setAnswered(label)
    await onAnswer?.(kind, value)
    setTimeout(onClose, 900)
  }

  return (
    <div className={`story-viewer bg-${s.bg}`} role="dialog" aria-modal="true" aria-label={`${s.label}, story ${i + 1} of ${stories.length}`}
         onPointerDown={e => {
           if (e.target.closest('.story-close, .story-option')) return
           press.current = { x: e.clientX, y: e.clientY, t: Date.now() }
           setPaused(true) // hold anywhere to pause
         }}
         onPointerUp={e => {
           const p = press.current; press.current = null
           setPaused(false)
           if (!p) return
           if (e.clientY - p.y > 90) return onClose() // swipe down
           if (Date.now() - p.t > 300) return // that was a hold: just resume
           if (s.options) return // the check-in card waits for an answer
           if (p.x < window.innerWidth * 0.35) prev(); else next() // a quick tap
         }}
         onPointerCancel={() => { press.current = null; setPaused(false) }}
         onContextMenu={e => e.preventDefault()}>
      <div className="story-bars" aria-hidden="true">
        {stories.map((_, k) => <span key={k}><i style={{ width: `${k < i ? 100 : k === i ? progress * 100 : 0}%` }} /></span>)}
      </div>
      <div className="story-top">
        <span className="story-kicker">{s.kicker}</span>
        <button type="button" className="story-close" onClick={onClose} aria-label="Close stories">×</button>
      </div>

      <div className="story-body">
        <h2 className="story-title">{s.title}</h2>
        {s.chips && <div className="story-chips">{s.chips.map(c => <span key={c}>{c}</span>)}</div>}
        {s.body && <p className="story-text">{s.body}</p>}
        {s.options && (
          <div className="story-options">
            {s.options.map(o => (
              <button key={o[0]} type="button" className={`story-option ${answered === o[0] ? 'on' : ''}`} disabled={!!answered} onClick={() => answer(o)}>{o[0]}</button>
            ))}
            {answered && <p className="story-text" role="status">Logged. Thank you for checking in 💜</p>}
          </div>
        )}
      </div>

      {/* For keyboards and screen readers; taps are handled above so a hold can pause. */}
      <button type="button" className="story-nav prev" onClick={e => { if (e.detail === 0) prev() }} aria-label="Previous story" />
      <button type="button" className="story-nav next" onClick={e => { if (e.detail === 0) next() }} aria-label="Next story" />
      {paused && <span className="story-paused" aria-hidden="true">Paused</span>}
      <div className="story-foot"><span>Hera</span><span>{i + 1} / {stories.length}</span></div>
    </div>
  )
}
