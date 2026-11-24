import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { ApiError, api } from '../lib/api'
import type { PumpCommand } from '../lib/api'
import { publishPumpStatus } from '../lib/pumpLive'
import { toast } from '../lib/toast'

/**
 * Kirim perintah pompa tanpa menunggu konfirmasi perangkat.
 * Status UI diperbarui optimistik seketika, lalu dikoreksi oleh pump/status MQTT.
 */
export function usePumpControl(deviceId: string) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (command: PumpCommand) => api.pump(deviceId, command),
    onSuccess: (_res, command) => {
      queryClient.invalidateQueries({ queryKey: ['pump-logs', deviceId] })
      toast.success(
        command === 'ON' ? 'Pompa menyala' : 'Pompa dimatikan',
        'Perintah berhasil dikirim ke perangkat.',
      )
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        if (error.code === 'FORBIDDEN') {
          toast.error('Anda tidak memiliki izin', 'Kontrol pompa hanya untuk admin.')
        } else if (error.code === 'RATE_LIMITED') {
          toast.error('Terlalu sering', 'Tunggu sebentar sebelum mengirim perintah lagi.')
        } else if (error.status === 0) {
          toast.error('Tidak dapat terhubung ke server', error.message)
        } else {
          toast.error('Perintah gagal dikirim', error.message)
        }
      }
    },
  })

  const send = useCallback(
    (command: PumpCommand) => {
      // Tampilkan hasil lebih dulu; MQTT akan menyelaraskan dengan kondisi nyata.
      publishPumpStatus(deviceId, command, Math.floor(Date.now() / 1000))
      mutation.mutate(command)
    },
    [deviceId, mutation],
  )

  return { send, isSending: mutation.isPending }
}
