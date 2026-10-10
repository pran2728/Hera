import { useState } from 'react'
import Today from './Today.jsx'
import Chat from './Chat.jsx'
import MyCycle from './MyCycle.jsx'
import Profile from './Profile.jsx'

const TABS = [
  ['today', 'Today', <><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></>],
  ['chat', 'Chat', <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z" />],
  ['cycle', 'Calendar', <><rect x="3" y="4.5" width="18" height="16.5" rx="3" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /></>],
  ['me', 'Me', <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>]
]

// The signed-in app: four tabs. Today and Chat stay mounted so nothing is lost when switching.
export default function Home({ session, profile, onProfileChange, onDeleted }) {
  const [tab, setTab] = useState(() => { try { return sessionStorage.getItem('hera-tab') || 'today' } catch { return 'today' } })
  const [version, setVersion] = useState(0) // bumps when something is logged, so other tabs refresh
  const go = t => { setTab(t); try { sessionStorage.setItem('hera-tab', t) } catch { /* private mode */ } }

  return (
    <div className="shell">
      <div className="shell-main">
        <div className="pane" hidden={tab !== 'today'}>
          <Today session={session} profile={profile} onProfileChange={onProfileChange} active={tab === 'today'}
                 onTalk={() => go('chat')} onLogged={() => setVersion(v => v + 1)} />
        </div>
        <div className="pane" hidden={tab !== 'chat'}>
          <Chat session={session} profile={profile} onProfileChange={onProfileChange} active={tab === 'chat'}
                version={version} onOpenCycle={() => go('cycle')} />
        </div>
        {tab === 'cycle' && <div className="pane"><MyCycle userId={session.user.id} /></div>}
        {tab === 'me' && <div className="pane"><Profile session={session} profile={profile} onSaved={onProfileChange} onDeleted={onDeleted} /></div>}
      </div>
      <nav className="tabbar" aria-label="Main">
        {TABS.map(([key, label, icon]) => (
          <button key={key} type="button" className={`tab ${tab === key ? 'on' : ''}`} aria-current={tab === key ? 'page' : undefined} onClick={() => go(key)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icon}</svg>
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
