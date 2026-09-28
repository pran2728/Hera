// Pull the name out of a friendly sentence: "You can call me Pran" -> "Pran".
const LEAD_INS = [
  /\b(?:you\s+can\s+|u\s+can\s+|just\s+|please\s+)?calls?\s+me\s+(.+)/i,
  /\b(?:my\s+name\s+is|my\s+name's|my\s+name)\s+(.+)/i,
  /\b(?:name's|name\s+is|names)\s+(.+)/i,
  /\b(?:i\s+go\s+by|i\s+prefer)\s+(.+)/i,
  /\b(?:i'm|i\s+am|im|it's|its|this\s+is)\s+(.+)/i
]
const TRAILING = /\b(please|pls|plz|thanks|thank\s+you|thx|here|only|haha|lol)\b.*$/i

export function extractName(text) {
  let s = String(text || '').trim()
  for (const re of LEAD_INS) {
    const m = s.match(re)
    if (m) { s = m[1]; break }
  }
  s = s
    .replace(TRAILING, '')
    .split(/[.,!?;:]|\s+-\s+|\s+(?:and|but|because)\s+/i)[0] // stop at the end of the phrase
    .replace(/[^\p{L}\p{M}'\-\s]/gu, ' ')                    // drop emojis and symbols
    .replace(/\s+/g, ' ')
    .trim()
  const words = s.split(' ').filter(Boolean).slice(0, 3)
  if (!words.length) return ''
  return words.map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}
