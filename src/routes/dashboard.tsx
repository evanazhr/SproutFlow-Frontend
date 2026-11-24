import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Thermometer, Waves } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ConnectionBadge from '../components/ConnectionBadge'
import MoistureGauge from '../components/MoistureGauge'
import PumpToggle from '../components/PumpToggle'
import SensorCard from '../components/SensorCard'
import { useAuth } from '../hooks/useAuth'
import { useDevice } from '../hooks/useDevice'
import { useMqttTelemetry } from '../hooks/useMqttTelemetry'
import { usePumpControl } from '../hooks/usePumpControl'
import { api } from '../lib/api'
import type { PumpCommand } from '../lib/api'
import { getSessionSafe } from '../lib/auth-client'
import { useLiveTelemetry } from '../lib/liveTelemetry'
import { usePumpLive } from '../lib/pumpLive'
import { env } from '../env'

export const Route = createFileRoute('/dashboard')({
  ssr: false,
  beforeLoad: async () => {
    const session = await getSessionSafe()
    if (!session?.user) throw redirect({ to: '/login' })
  },
  component: DashboardPage,
})

// Threshold default = default kolom device_settings di database (PRD 5).
const DEFAULT_THRESHOLD = 35

type Range = '1h' | '24h' | '7d'

const RANGES: Array<{ key: Range; label: string; ms: number; interval: 'raw' | '5m' | '1h' }> = [
  { key: '1h', label: '1 jam', ms: 3_600_000, interval: 'raw' },
  // Server membatasi limit 200 → interval 5 menit mencakup rentang terbaru
  { key: '24h', label: '24 jam', ms: 86_400_000, interval: '5m' },
  { key: '7d', label: '7 hari', ms: 7 * 86_400_000, interval: '1h' },
]

const fmt = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined ? '—' : n.toFixed(digits)

function DashboardPage() {
  const deviceId = env.VITE_DEVICE_ID
  const { isAdmin } = useAuth()
  const device = useDevice(deviceId)
  const { status, lastUpdated } = useMqttTelemetry(deviceId)
  const liveTelemetry = useLiveTelemetry(deviceId)
  const livePump = usePumpLive(deviceId)
  const { send } = usePumpControl(deviceId)
  const [range, setRange] = useState<Range>('1h')

  // Ambang untuk warna gauge; settings hanya bisa diakses admin → fallback default
  const settings = useQuery({
    queryKey: ['settings', deviceId],
    queryFn: () => api.settings(deviceId),
    select: (res) => res.data,
    enabled: isAdmin,
  })
  const threshold = settings.data?.moisture_threshold ?? DEFAULT_THRESHOLD
  const pumpMode = settings.data?.pump_mode ?? 'auto'

  const activeRange = RANGES.find((r) => r.key === range) ?? RANGES[0]
  const readings = useQuery({
    queryKey: ['readings', deviceId, range],
    queryFn: () =>
      api.readings(deviceId, {
        from: new Date(Date.now() - activeRange.ms).toISOString(),
        to: new Date().toISOString(),
        interval: activeRange.interval,
        limit: 200,
      }),
    select: (res) => res.data,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  })

  const chartData = useMemo(
    () =>
      (readings.data ?? [])
        .slice()
        .reverse()
        .map((r) => ({
          t: r.recorded_at,
          soil_moisture: r.soil_moisture,
          temperature: r.temperature,
          humidity: r.humidity,
        })),
    [readings.data],
  )

  const data = device.data
  // Bacaan MQTT lebih baru daripada REST; refetch DB tidak menimpanya.
  const latest = liveTelemetry ?? data?.latest ?? null
  const offline = data ? !data.online : true
  // Perubahan status langsung tampil, tidak menunggu ack atau refetch REST.
  const pumpStatus: PumpCommand = livePump?.status ?? data?.pump_status ?? 'OFF'
  const deviceError = device.isError ? (device.error instanceof Error ? device.error.message : 'Terjadi kesalahan.') : null

  return (
    <main className="page-wrap px-4 pb-16 pt-8">
      <div className="status-strip rise-in">
        <div className="status-device">
          <div>
            <p className="status-device-name">{data?.name ?? deviceId}</p>
            <p className="status-device-sub">Pemantauan tanaman</p>
          </div>
          <span className={`badge ${offline ? 'badge-off' : 'badge-on'}`}>
            <span className="badge-dot" aria-hidden="true" />
            {offline ? 'Offline' : 'Dalam jaringan'}
          </span>
        </div>
        <ConnectionBadge status={status} lastUpdated={lastUpdated} />
      </div>

      {deviceError ? (
        <div className="inline-notice rise-in" role="status">
          <span>Perangkat belum terhubung. {deviceError}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void device.refetch()}>Coba lagi</button>
        </div>
      ) : null}

          <section className="dash-grid rise-in">
            <div className="island-shell panel-pad gauge-panel">
              <div className="panel-head">
                <h1 className="panel-title">Kelembapan tanah</h1>
              </div>
              <MoistureGauge
                value={latest ? latest.soil_moisture : null}
                threshold={threshold}
                loading={device.isLoading}
              />
              <p className="panel-foot">
                {latest
                  ? `Terukur ${new Date(latest.recorded_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
                  : 'Belum ada pembacaan — menunggu telemetry perangkat.'}
              </p>
            </div>

            <div className="dash-side">
              <div className="sensor-pair">
                <SensorCard
                  icon={<Thermometer size={20} strokeWidth={2.2} />}
                  label="Suhu udara"
                  value={latest ? fmt(latest.temperature, 1) : '—'}
                  unit="°C"
                  tone="dry"
                  loading={device.isLoading}
                />
                <SensorCard
                  icon={<Waves size={20} strokeWidth={2.2} />}
                  label="Kelembapan udara"
                  value={latest ? fmt(latest.humidity) : '—'}
                  unit="%"
                  tone="water"
                  loading={device.isLoading}
                />
              </div>
              <div className="island-shell panel-pad pump-card">
                <p className="section-kicker">Kontrol</p>
                <PumpToggle
                  pumpStatus={pumpStatus}
                  online={data?.online ?? false}
                  isAdmin={isAdmin}
                  pumpMode={pumpMode}
                  onSend={send}
                />
              </div>
            </div>
          </section>

          <section className="island-shell panel-pad chart-panel rise-in">
            <div className="panel-head">
              <h2 className="panel-title">Tren sensor</h2>
              <div className="tabs" role="tablist" aria-label="Rentang waktu">
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    role="tab"
                    aria-selected={range === r.key}
                    className={`tab ${range === r.key ? 'is-active' : ''}`}
                    onClick={() => setRange(r.key)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            {readings.isLoading ? (
              <div className="chart-skel" aria-hidden="true">
                <span className="skel skel-chart" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="table-empty">
                <p className="table-empty-title">Belum ada data tren</p>
                <p className="table-empty-desc">
                  Grafik terisi setelah perangkat mengirim telemetry lewat MQTT.
                </p>
              </div>
            ) : (
              <div className="chart-box">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grad-leaf" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--leaf)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--leaf)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="grad-dry" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--dry)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--dry)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="grad-water" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--water)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--water)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 6" stroke="var(--line)" vertical={false} />
                    <XAxis
                      dataKey="t"
                      tickFormatter={(v: string) =>
                        new Date(v).toLocaleString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          ...(range !== '1h' ? { day: '2-digit', month: '2-digit' } : {}),
                        })
                      }
                      tick={{ fontSize: 11, fill: 'var(--sea-ink-soft)' }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={48}
                    />
                    <YAxis
                      domain={[0, 'auto']}
                      tick={{ fontSize: 11, fill: 'var(--sea-ink-soft)' }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--surface-strong)',
                        border: '1px solid var(--line)',
                        borderRadius: 12,
                        fontSize: 12.5,
                        color: 'var(--sea-ink)',
                      }}
                      labelStyle={{ color: 'var(--sea-ink-soft)' }}
                      labelFormatter={(v: unknown) =>
                        new Date(String(v)).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="soil_moisture"
                      name="Tanah (%)"
                      stroke="var(--leaf)"
                      strokeWidth={2}
                      fill="url(#grad-leaf)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="temperature"
                      name="Suhu (°C)"
                      stroke="var(--dry)"
                      strokeWidth={2}
                      fill="url(#grad-dry)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="humidity"
                      name="Udara (%)"
                      stroke="var(--water)"
                      strokeWidth={2}
                      fill="url(#grad-water)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="chart-legend">
                  <span><i style={{ background: 'var(--leaf)' }} /> Tanah</span>
                  <span><i style={{ background: 'var(--dry)' }} /> Suhu</span>
                  <span><i style={{ background: 'var(--water)' }} /> Udara</span>
                </div>
              </div>
            )}
          </section>
    </main>
  )
}
