import { useSyncExternalStore } from 'react'
import type { LatestReading } from './api'

/**
 * Bacaan sensor terakhir dari MQTT `telemetry`.
 *
 * Disimpan terpisah dari cache TanStack Query karena query `device` di-refetch
 * tiap 30 detik dari REST, sedangkan backend hanya menyimpan sensor_readings
 * tiap 60 detik. Data DB yang lebih lama tidak boleh menimpa data realtime.
 */
export interface LiveTelemetry extends LatestReading {
  ts: number
  /** Naik setiap kali bacaan baru diterima. */
  version: number
}

const states = new Map<string, LiveTelemetry>()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function publishTelemetry(
  deviceId: string,
  reading: Omit<LiveTelemetry, 'version'>,
) {
  const prev = states.get(deviceId)
  states.set(deviceId, { ...reading, version: (prev?.version ?? 0) + 1 })
  emit()
}

export function getLiveTelemetry(deviceId: string): LiveTelemetry | null {
  return states.get(deviceId) ?? null
}

export function clearLiveTelemetry(deviceId: string) {
  states.delete(deviceId)
  emit()
}

export function subscribeLiveTelemetry(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useLiveTelemetry(deviceId: string): LiveTelemetry | null {
  return useSyncExternalStore(
    subscribeLiveTelemetry,
    () => getLiveTelemetry(deviceId),
    () => null,
  )
}
