// Colour themes. The choice is saved on her profile and cached on the device so the app opens in it.
export const THEMES = [
  ['plum', 'Plum', '#6B2D5C'],
  ['rose', 'Rose', '#A3305A'],
  ['lavender', 'Lavender', '#5B3FA0'],
  ['ocean', 'Ocean', '#1F6F8B'],
  ['forest', 'Forest', '#3F6E4A'],
  ['sunset', 'Sunset', '#A4472B']
]
const KEY = 'hera-theme'

export function applyTheme(key) {
  const t = THEMES.find(x => x[0] === key) ?? THEMES[0]
  const root = document.documentElement
  if (t[0] === 'plum') delete root.dataset.theme
  else root.dataset.theme = t[0]
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t[2])
  try { localStorage.setItem(KEY, t[0]) } catch { /* private mode */ }
}

export function savedTheme() {
  try { return localStorage.getItem(KEY) || 'plum' } catch { return 'plum' }
}
