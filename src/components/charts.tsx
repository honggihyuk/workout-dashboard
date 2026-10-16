// 간단한 그래프: 볼륨 막대(U5), 체중·컨디션 추이 선
import { daysBetween, shortLabel } from '../lib/dates'

export function VolumeBars({ items, label, unit = 'kg', digits = 0 }: { items: { date: string; value: number }[]; label: string; unit?: string; digits?: number }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  const fmt = (v: number) => Number(v.toFixed(digits)).toLocaleString('ko-KR')
  return (
    <div className="bars" role="img" aria-label={label + ': ' + items.map((i) => `${shortLabel(i.date)} ${fmt(i.value)}${unit}`).join(', ')}>
      {items.map((it, i) => (
        <div className="bar-col" key={it.date + i}>
          <span className="bar-val">{fmt(it.value)}</span>
          <div className={'bar' + (i === items.length - 1 ? ' last' : '')} style={{ height: `${Math.max(4, (it.value / max) * 84)}%` }} />
          <span className="bar-val">{shortLabel(it.date)}</span>
        </div>
      ))}
    </div>
  )
}

export interface Series {
  name: string
  color: string
  points: { date: string; value: number }[]
  dashed?: boolean
}

/** 기간(from~to) 안의 선 그래프. 값 범위는 자동, fixed가 있으면 고정 (예: 컨디션 1~5) */
export function LineChart({
  series,
  from,
  to,
  label,
  fixed,
  height = 120,
  unit = '',
}: {
  series: Series[]
  from: string
  to: string
  label: string
  fixed?: [number, number]
  height?: number
  unit?: string
}) {
  const W = 320
  const H = height
  const pad = 10
  const all = series.flatMap((s) => s.points.map((p) => p.value))
  if (!all.length) return <p className="muted">이 기간에는 기록이 없어요.</p>
  let lo = fixed ? fixed[0] : Math.min(...all)
  let hi = fixed ? fixed[1] : Math.max(...all)
  if (!fixed) {
    const span = Math.max(hi - lo, 1)
    lo -= span * 0.15
    hi += span * 0.15
  }
  const dataHi = Math.max(...all)
  const dataLo = Math.min(...all)
  const total = Math.max(1, daysBetween(from, to))
  const x = (d: string) => (daysBetween(from, d) / total) * W
  const y = (v: number) => pad + (1 - (v - lo) / (hi - lo)) * (H - pad * 2)
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {fixed &&
        [fixed[0], (fixed[0] + fixed[1]) / 2, fixed[1]].map((v) => (
          <line key={v} x1={0} x2={W} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} />
        ))}
      {!fixed && (
        <>
          <line x1={0} x2={W} y1={y(dataHi)} y2={y(dataHi)} stroke="var(--border)" strokeDasharray="2 4" />
          <line x1={0} x2={W} y1={y(dataLo)} y2={y(dataLo)} stroke="var(--border)" strokeDasharray="2 4" />
          <text x={W} y={y(dataHi) - 4} textAnchor="end" fontSize="11" fill="var(--muted)">
            최고 {Number(dataHi.toFixed(1))}
            {unit}
          </text>
          <text x={W} y={y(dataLo) + 13} textAnchor="end" fontSize="11" fill="var(--muted)">
            최저 {Number(dataLo.toFixed(1))}
            {unit}
          </text>
        </>
      )}
      {series.map((s) => {
        const pts = s.points.map((p) => `${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
        return (
          <g key={s.name}>
            <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? '5 4' : undefined} />
            {s.points.length <= 31 &&
              s.points.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r={2.6} fill={s.color} />)}
          </g>
        )
      })}
    </svg>
  )
}
