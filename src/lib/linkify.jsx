// Turns https:// links in Hera's messages into tappable links (opened in a new tab).
const URL_RE = /(https:\/\/[^\s)]+[^\s).,!?])/g

export function linkify(text) {
  const parts = String(text ?? '').split(URL_RE)
  return parts.map((p, i) => i % 2 === 1
    ? <a key={i} href={p} target="_blank" rel="noreferrer" className="msg-link">{p.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>
    : p)
}
