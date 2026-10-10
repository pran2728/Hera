import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// Fonts are bundled with the app (faster, works offline, no calls to Google).
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/700.css'
import '@fontsource/cormorant-garamond/500-italic.css'
import '@fontsource/cormorant-garamond/600-italic.css'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import '@fontsource/nunito/800.css'
import './styles.css'
import { captureInviteFromUrl } from './lib/partner'
import { applyTheme, savedTheme } from './lib/theme'
import { registerSW } from 'virtual:pwa-register'

// Pick up new versions of Hera straight away. An installed app (home-screen icon) can stay open for days,
// so also check for an update whenever she comes back to it, and reload once the new version is ready.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return
    const check = () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}) }
    document.addEventListener('visibilitychange', check)
    setInterval(check, 30 * 60 * 1000)
  }
})

captureInviteFromUrl() // opened from a partner invite link
applyTheme(savedTheme()) // open in her colours straight away

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
