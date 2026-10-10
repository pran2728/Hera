// Colour themes. The choice is saved on her profile and cached on the device so the app opens in it.
// [key, label, swatch, light background, dark background]
export const THEMES = [
  ['plum', 'Plum', '#E8849A', '#FDF0F2', '#221634'],
  ['rose', 'Rose', '#F06C98', '#FFF1F4', '#26111C'],
  ['lavender', 'Lavender', '#A58BE6', '#F6F1FD', '#18132A'],
  ['ocean', 'Ocean', '#4FA7C2', '#EFF7F9', '#0E1D24'],
  ['forest', 'Forest', '#6FAE80', '#F1F7F1', '#111D15'],
  ['sunset', 'Sunset', '#EE8A5E', '#FFF3EC', '#24130C']
]
const KEY = 'hera-theme'

export function applyTheme(key) {
  const t = THEMES.find(x => x[0] === key) ?? THEMES[0]
  const root = document.documentElement
  if (t[0] === 'plum') delete root.dataset.theme
  else root.dataset.theme = t[0]
  // The phone's status bar matches the app background.
  const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? t[4] : t[3])
  try { localStorage.setItem(KEY, t[0]) } catch { /* private mode */ }
}

export function savedTheme() {
  try { return localStorage.getItem(KEY) || 'plum' } catch { return 'plum' }
}
