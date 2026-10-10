import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Hera is a Progressive Web App: it installs to the home screen on
// Android, iPhone and laptops straight from the browser.
export default defineConfig({
  // Shown at the bottom of Me, so we can tell which version a phone is running.
  define: { __BUILD__: JSON.stringify(new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { importScripts: ['push-sw.js'], globPatterns: ['**/*.{js,css,html,svg,png}', '**/*-latin-*.woff2'] },
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Hera',
        short_name: 'Hera',
        description: 'Your cycle companion. Just talk to her.',
        theme_color: '#6B2D5C',
        background_color: '#FFF8F3',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})
