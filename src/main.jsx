import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'
import { captureInviteFromUrl } from './lib/partner'
import { applyTheme, savedTheme } from './lib/theme'

captureInviteFromUrl() // opened from a partner invite link
applyTheme(savedTheme()) // open in her colours straight away

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
