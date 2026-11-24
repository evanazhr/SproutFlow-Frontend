import { useSyncExternalStore } from 'react'
import type { PumpCommand } from './api'

/**
 * Status pompa terkini (dari MQTT atau aksi lokal).
 *
 * Disimpan terpisah dari cache TanStack Query karena query `device` di-refetch
 * berkala dari REST. Status yang baru dikirim tidak boleh menunggu ack MQTT
 * atau ikut tertimpa data lama dari DB.
 */
export interface PumpLiveState {
  status: PumpCommand
  ts: number
  /** Naik setiap kali status berubah; dipakai UI untuk membaca perubahan. */
  version: number
}

const states = new Map<string, PumpLiveState>()
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function publishPumpStatus(deviceId: string, status: PumpCommand, ts: number) {
  const prev = states.get(deviceId)
  states.set(deviceId, {
    status,
    ts,
    version: (prev?.version ?? 0) + 1,
  })
  emit()
}

export function getPumpLiveState(deviceId: string): PumpLiveState | null {
  return states.get(deviceId) ?? null
}

export function clearPumpLiveState(deviceId: string) {
  states.delete(deviceId)
  emit()
}

export function subscribePumpLive(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePumpLive(deviceId: string): PumpLiveState | null {
  return useSyncExternalStore(
    subscribePumpLive,
    () => getPumpLiveState(deviceId),
    () => null,
  )
}
