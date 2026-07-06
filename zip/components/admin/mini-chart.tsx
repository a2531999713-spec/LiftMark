export function Sparkline({
  data,
  className = '',
  stroke = 'var(--primary)',
}: {
  data: number[]
  className?: string
  stroke?: string
}) {
  const w = 220
  const h = 60
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const step = w / (data.length - 1)
  const points = data.map((d, i) => [i * step, h - ((d - min) / range) * (h - 8) - 4])
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${path} L${w},${h} L0,${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} preserveAspectRatio="none" role="img" aria-hidden>
      <path d={area} fill={stroke} opacity={0.1} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function MiniBars({
  data,
  className = '',
  fill = 'var(--primary)',
}: {
  data: number[]
  className?: string
  fill?: string
}) {
  const max = Math.max(...data) || 1
  return (
    <div className={`flex items-end gap-1 ${className}`}>
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm"
          style={{ height: `${(d / max) * 100}%`, backgroundColor: fill, opacity: 0.35 + (0.65 * d) / max }}
        />
      ))}
    </div>
  )
}
