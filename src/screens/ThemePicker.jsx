import { useState } from 'react'
import { THEMES, applyTheme, savedTheme } from '../lib/theme'

// Colour swatches. Changes apply instantly; onPick saves the choice (optional).
export default function ThemePicker({ value, onPick }) {
  const [current, setCurrent] = useState(value || savedTheme())
  function pick(key) {
    setCurrent(key); applyTheme(key); onPick?.(key)
  }
  return (
    <div className="swatches" role="radiogroup" aria-label="Colour theme">
      {THEMES.map(([key, label, hex]) => (
        <button key={key} type="button" role="radio" aria-checked={current === key}
                className={`swatch ${current === key ? 'on' : ''}`} onClick={() => pick(key)}>
          <span className="dot" style={{ background: hex }} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
