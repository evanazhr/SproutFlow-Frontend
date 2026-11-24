export type MoistureZone = 'kering' | 'ideal' | 'basah'

const R = 86
const CX = 110
const CY = 118
const ARC_LEN = Math.PI * R

function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) }
}

const TRACK_START = polar(180, R)
const TRACK_END = polar(0, R)

const ZONE_LABEL: Record<MoistureZone, string> = {
  kering: 'Kering',
  ideal: 'Ideal',
  basah: 'Basah',
}

/**
 * Gauge kelembapan tanah: busur setengah lingkaran dengan penanda ambang.
 * Zona warna: < ambang = kering (amber), < 80 = ideal (hijau), >= 80 = basah (biru).
 */
export default function MoistureGauge({
  value,
  threshold,
  loading = false,
}: {
  value: number | null
  threshold: number
  loading?: boolean
}) {
  const zone: MoistureZone =
    value === null ? 'kering' : value < threshold ? 'kering' : value >= 80 ? 'basah' : 'ideal'
  const color =
    zone === 'kering' ? 'var(--dry)' : zone === 'basah' ? 'var(--water)' : 'var(--leaf)'
  const shown = value === null ? null : Math.min(100, Math.max(0, value))

  const dash = shown === null ? 0 : (shown / 100) * ARC_LEN
  const dot = shown === null ? null : polar(180 - (shown / 100) * 180, R)
  const thrTick = polar(180 - (threshold / 100) * 180, R)
  const thrTickIn = polar(180 - (threshold / 100) * 180, R - 20)
  const wetTick = polar(180 - 0.8 * 180, R)
  const needleEnd = shown === null ? null : polar(180 - (shown / 100) * 180, R - 24)

  return (
    <figure
      className={`gauge zone-${zone}`}
      role="img"
      aria-label={
        shown === null
          ? 'Kelembapan tanah belum tersedia'
          : `Kelembapan tanah ${shown} persen, kategori ${ZONE_LABEL[zone]}`
      }
    >
      <svg viewBox="0 0 220 132" className="gauge-svg">
        <path
          className="gauge-track"
          d={`M ${TRACK_START.x} ${TRACK_START.y} A ${R} ${R} 0 0 1 ${TRACK_END.x} ${TRACK_END.y}`}
          fill="none"
        />
        <path
          className="gauge-fill"
          d={`M ${TRACK_START.x} ${TRACK_START.y} A ${R} ${R} 0 0 1 ${TRACK_END.x} ${TRACK_END.y}`}
          fill="none"
          stroke={color}
          style={{ strokeDasharray: `${dash} ${ARC_LEN + 10}` }}
        />
        {/* skala analog */}
        {Array.from({ length: 11 }, (_, i) => {
          const angle = 180 - i * 18
          const from = polar(angle, R - 14)
          const to = polar(angle, R + 2)
          return (
            <line
              key={`tick-${i}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              className="gauge-scale"
            />
          )
        })}
        {/* jarum dan as kuningan */}
        {needleEnd ? (
          <line
            x1={CX}
            y1={CY}
            x2={needleEnd.x}
            y2={needleEnd.y}
            className="gauge-needle"
          />
        ) : null}
        <circle cx={CX} cy={CY} r="6" className="gauge-hub" />
        {/* penanda ambang (kering) */}
        <line
          x1={thrTickIn.x}
          y1={thrTickIn.y}
          x2={thrTick.x}
          y2={thrTick.y}
          className="gauge-tick"
        />
        {/* penanda basah */}
        <line
          x1={polar(180 - 0.8 * 180, R - 20).x}
          y1={polar(180 - 0.8 * 180, R - 20).y}
          x2={wetTick.x}
          y2={wetTick.y}
          className="gauge-tick gauge-tick-wet"
        />
        {dot ? <circle cx={dot.x} cy={dot.y} r="7" className="gauge-dot" fill={color} /> : null}
      </svg>
      <div className="gauge-readout">
        {loading || shown === null ? (
          <span className="skel skel-value" />
        ) : (
          <>
            <p className="gauge-value num">
              {shown}
              <span className="gauge-unit">%</span>
            </p>
            <p className="gauge-zone">
              <span className={`zone-chip chip-${zone}`}>{ZONE_LABEL[zone]}</span>
            </p>
          </>
        )}
      </div>
      <figcaption className="gauge-caption">
        <span>0 · kering</span>
        <span className="gauge-threshold">ambang {threshold}%</span>
        <span>basah · 100</span>
      </figcaption>
    </figure>
  )
}
