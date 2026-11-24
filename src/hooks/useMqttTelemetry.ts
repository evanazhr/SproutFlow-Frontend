import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { DeviceDetail, Envelope } from '../lib/api'
import { connectMqtt, type MqttStatus } from '../lib/mqtt'
import { publishPumpStatus } from '../lib/pumpLive'

/**
 * Satu koneksi MQTT singleton per aplikasi; pesan ditulis ke cache
 * TanStack Query (key ['device', id]) agar sinkron dengan data REST.
 *
 * Penting: cache query 'device' menyimpan bentuk respons REST
 * ({ data: DeviceDetail }), bukan DeviceDetail polos — karena itu update
 * MQTT harus menulis ke dalam field `data`, kalau tidak, `select: res.data`
 * akan terus mengembalikan data lama dan update realtime hilang.
 */
export function useMqttTelemetry(deviceId: string) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<MqttStatus>('connecting')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    connectMqtt(
      setStatus,
      (message) => {
        switch (message.type) {
          case 'telemetry': {
            const recordedAt = new Date(message.ts * 1000).toISOString()
            queryClient.setQueryData<Envelope<DeviceDetail>>(
              ['device', deviceId],
              (prev) =>
                prev
                  ? {
                      ...prev,
                      data: {
                        ...prev.data,
                        online: true,
                        latest: {
                          soil_moisture: message.soil_moisture,
                          temperature: message.temperature,
                          humidity: message.humidity,
                          recorded_at: recordedAt,
                        },
                      },
                    }
                  : prev,
            )
            setLastUpdated(new Date())
            break
          }
          case 'pump_status':
            publishPumpStatus(deviceId, message.pump_status, message.ts)
            queryClient.setQueryData<Envelope<DeviceDetail>>(
              ['device', deviceId],
              (prev) =>
                prev
                  ? {
                      ...prev,
                      data: { ...prev.data, online: true, pump_status: message.pump_status },
                    }
                  : {
                      data: {
                        id: deviceId,
                        name: deviceId,
                        online: true,
                        pump_status: message.pump_status,
                        latest: null,
                      },
                    },
            )
            setLastUpdated(new Date())
            break
          case 'status':
            queryClient.setQueryData<Envelope<DeviceDetail>>(
              ['device', deviceId],
              (prev) =>
                prev ? { ...prev, data: { ...prev.data, online: message.online } } : prev,
            )
            break
        }
      },
    )
    return undefined
  }, [deviceId, queryClient])

  return { status, lastUpdated }
}
