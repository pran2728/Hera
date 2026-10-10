// "Your patterns" (trends + 90-day stats) and the podcast pick, on the My cycle screen.
import { cycleTrends, symptomStats } from '../lib/stats'
import { podcastFor } from '../lib/podcasts'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function trendWords(t, kind) {
  if (!t) return null
  const n = Math.abs(t.diff)
  if (t.direction === 'steady') return 'steady lately'
  if (kind === 'pain') return t.direction === 'up' ? `worse lately (+${n})` : `easing lately (−${n})`
  return t.direction === 'up' ? `getting longer (+${n} days)` : `getting shorter (−${n} days)`
}

// One series, so one colour and no legend; every bar is labelled with its value.
function CycleBars({ cycles }) {
  const data = cycles.slice(-6)
  const W = 300, H = 120, base = 96, top = 18, gap = 10
  const max = Math.max(...data.map(c => c.length), 35)
  const bw = (W - gap * (data.length - 1)) / data.length
  return (
    <svg className="bars" viewBox={`0 0 ${W} ${H}`} role="img"
         aria-label={`Cycle lengths: ${data.map(c => `${c.length} days`).join(', ')}`}>
      <line x1="0" x2={W} y1={base} y2={base} className="bars-base" />
      {data.map((c, i) => {
        const h = Math.max(4, ((base - top) * c.length) / max)
        const x = i * (bw + gap), y = base - h
        const m = MON[Number(c.start.slice(5, 7)) - 1]
        return (
          <g key={c.start}>
            <title>{`Cycle from ${Number(c.start.slice(8))} ${m}: ${c.length} days`}</title>
            <path className="bar" d={`M${x},${base} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + bw - 4} Q${x + bw},${y} ${x + bw},${y + 4} V${base} Z`} />
            <text x={x + bw / 2} y={y - 5} textAnchor="middle" className="bar-val">{c.length}</text>
            <text x={x + bw / 2} y={base + 16} textAnchor="middle" className="bar-lbl">{m}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function PatternsCard({ logs, today, showCycle }) {
  const starts = logs.filter(l => l.kind === 'period_start').map(l => l.log_date)
  const ends = logs.filter(l => l.kind === 'period_end').map(l => l.log_date)
  const t = cycleTrends(starts, ends, logs)
  const s = symptomStats(logs, today)
  const energy = s.energy.length ? s.energy.map(e => `${e.name} ${e.count}×`).join(' · ') : null

  return (
    <section className="card">
      <h2>Your patterns</h2>
      {showCycle && (t.cycles.length >= 2
        ? <>
            <p className="muted small">Cycle length, last {Math.min(t.cycles.length, 6)} cycles (days)</p>
            <CycleBars cycles={t.cycles} />
            <dl className="facts">
              <div><dt>Average cycle</dt><dd>{t.cycleAvg} days<small>{t.cycleRange[0]}–{t.cycleRange[1]} days{t.regular === true ? ' · regular' : t.regular === false ? ' · varies' : ''}{t.cycleTrend ? ` · ${trendWords(t.cycleTrend)}` : ''}</small></dd></div>
              {t.periodAvg && <div><dt>Period length</dt><dd>{t.periodAvg} days<small>{trendWords(t.periodTrend) ?? 'log when it ends to track this'}</small></dd></div>}
              {t.painAvg !== null && <div><dt>Pain per cycle</dt><dd>{t.painAvg}/10<small>{trendWords(t.painTrend, 'pain') ?? `average over ${t.pain.length} cycle${t.pain.length === 1 ? '' : 's'}`}</small></dd></div>}
            </dl>
            {t.painTrend?.direction === 'up' && t.painTrend.diff >= 2 && (
              <p className="tip">Your pain has been getting worse. That's worth mentioning to a gynaecologist.</p>
            )}
          </>
        : <p className="muted small">Log 2 or more periods and your cycle trends will show here.</p>)}

      <h3 className="mini">Last 90 days</h3>
      {s.daysLogged === 0
        ? <p className="muted small">Nothing logged yet. Tell Hera how you feel, e.g. "bloated and tired today".</p>
        : <>
            <dl className="facts">
              <div><dt>Days you checked in</dt><dd>{s.daysLogged}</dd></div>
              {s.painDays > 0 && <div><dt>Pain</dt><dd>{s.painDays} day{s.painDays === 1 ? '' : 's'}<small>avg {s.painAvg}/10 · worst {s.painMax}/10</small></dd></div>}
              {s.moods.length > 0 && <div><dt>Most common mood</dt><dd>{s.moods[0].name}<small>{s.moods[0].count}×</small></dd></div>}
              {energy && <div><dt>Energy</dt><dd>{energy}</dd></div>}
            </dl>
            {s.symptoms.length > 0 && (
              <div className="food-chips" aria-label="Top symptoms">
                {s.symptoms.map(x => <span key={x.name} className="food">{x.name} · {x.count}</span>)}
              </div>
            )}
          </>}
    </section>
  )
}

export function PodcastCard({ profile, cycle, today }) {
  const pod = podcastFor(profile, cycle, today)
  return (
    <section className="card">
      <h2>🎧 Listen pick for right now</h2>
      <p className="pod-name">{pod.name}</p>
      <p className="muted small pod-by">{pod.host} · {pod.show}</p>
      <p className="tip">{pod.why[0].toUpperCase() + pod.why.slice(1)}</p>
      <a className="chip small pod-link" href={pod.url} target="_blank" rel="noreferrer">Listen ↗</a>
      <p className="fine">A new pick every 3 days, matched to your phase.</p>
    </section>
  )
}
