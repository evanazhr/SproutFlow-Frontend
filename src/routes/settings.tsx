import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { getSessionSafe } from '../lib/auth-client'
import { ApiError, api } from '../lib/api'
import type { PumpMode } from '../lib/api'
import { toast } from '../lib/toast'
import { env } from '../env'

export const Route = createFileRoute('/settings')({
  ssr: false,
  beforeLoad: async () => {
    const session = await getSessionSafe()
    if (!session?.user) throw redirect({ to: '/login' })
  },
  component: SettingsPage,
})

const thresholdSchema = z.object({
  moisture_threshold: z
    .number('Ambang harus berupa angka')
    .int('Gunakan bilangan bulat')
    .min(0, 'Ambang minimal 0')
    .max(100, 'Ambang maksimal 100'),
})

// Validator level field memvalidasi nilai field langsung (angka)
const thresholdFieldSchema = thresholdSchema.shape.moisture_threshold

function SettingsPage() {
  const deviceId = env.VITE_DEVICE_ID
  const queryClient = useQueryClient()

  const settings = useQuery({
    queryKey: ['settings', deviceId],
    queryFn: () => api.settings(deviceId),
    select: (res) => res.data,
    retry: false,
  })

  const save = useMutation({
    mutationFn: (moisture_threshold: number) => api.updateSettings(deviceId, moisture_threshold),
    onSuccess: (res) => {
      queryClient.setQueryData(['settings', deviceId], res)
      queryClient.invalidateQueries({ queryKey: ['settings', deviceId] })
      toast.success('Pengaturan tersimpan', 'Ambang kelembapan diperbarui.')
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error('Gagal menyimpan', error.message)
      }
    },
  })

  const saveMode = useMutation({
    mutationFn: (pump_mode: PumpMode) => api.updatePumpMode(deviceId, pump_mode),
    onSuccess: (res) => {
      queryClient.setQueryData(['settings', deviceId], res)
      toast.success(
        'Mode pompa diperbarui',
        res.data.pump_mode === 'auto'
          ? 'Pompa dikendalikan otomatis sesuai setpoint.'
          : 'Pompa dikendalikan lewat tombol dashboard.',
      )
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        toast.error('Gagal menyimpan', error.message)
      }
    },
  })

  if (settings.isLoading) {
    return (
      <main className="page-wrap px-4 pb-16 pt-8">
        <div className="island-shell panel-pad" aria-hidden="true">
          <span className="skel skel-label" />
          <span className="skel skel-value" />
          <span className="skel skel-row" />
        </div>
      </main>
    )
  }

  if (settings.isError || !settings.data) {
    return (
      <main className="page-wrap px-4 pb-16 pt-8">
        <section className="island-shell panel-pad error-panel" role="alert">
          <h1 className="panel-title">Pengaturan tidak bisa dimuat</h1>
          <p className="panel-desc">
            {settings.error instanceof Error ? settings.error.message : 'Terjadi kesalahan.'}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void settings.refetch()}
          >
            Coba lagi
          </button>
        </section>
      </main>
    )
  }

  const data = settings.data

  return (
    <main className="page-wrap px-4 pb-16 pt-8">
      <header className="page-head rise-in">
        <h1 className="page-title">Pengaturan</h1>
        <p className="page-sub">
          Ambang batas untuk perangkat <strong>{data.device_id}</strong>.
          {data.updated_at
            ? ` Terakhir diubah ${new Date(data.updated_at).toLocaleString('id-ID')}.`
            : ' Belum pernah diubah.'}
        </p>
      </header>

      <section className="island-shell panel-pad settings-panel rise-in">
        <div className="field">
          <span className="field-label" id="pump-mode-label">
            Mode kontrol pompa
          </span>
          <div className="tabs" role="group" aria-labelledby="pump-mode-label">
            <button
              type="button"
              className={`tab ${data.pump_mode === 'auto' ? 'is-active' : ''}`}
              disabled={saveMode.isPending}
              onClick={() => saveMode.mutate('auto')}
            >
              Otomatis
            </button>
            <button
              type="button"
              className={`tab ${data.pump_mode === 'manual' ? 'is-active' : ''}`}
              disabled={saveMode.isPending}
              onClick={() => saveMode.mutate('manual')}
            >
              Manual
            </button>
          </div>
          <p className="field-help">
            {data.pump_mode === 'auto'
              ? 'Pompa menyala saat kelembapan tanah di bawah setpoint, dan mati saat setpoint tercapai. Tombol dashboard dinonaktifkan.'
              : 'Pompa hanya dikontrol lewat tombol di dashboard. Logika otomatis tidak berjalan.'}
          </p>
        </div>

        <SettingsForm
          key={data.updated_at ?? 'initial'}
          initial={data.moisture_threshold}
          onSubmit={(value) => save.mutateAsync(value)}
          saving={save.isPending}
        />
        <p className="settings-note">
          Setpoint dipakai mode Otomatis: pompa menyira saat kelembapan di bawah nilai ini dan
          berhenti saat tercapai.
        </p>
      </section>
    </main>
  )
}

function SettingsForm({
  initial,
  onSubmit,
  saving,
}: {
  initial: number
  onSubmit: (value: number) => Promise<unknown>
  saving: boolean
}) {
  const form = useForm({
    defaultValues: { moisture_threshold: initial },
    validators: { onSubmit: thresholdSchema },
    onSubmit: async ({ value, formApi }) => {
      await onSubmit(value.moisture_threshold)
      formApi.reset({ moisture_threshold: value.moisture_threshold })
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <form.Field
        name="moisture_threshold"
        validators={{ onChange: thresholdFieldSchema }}
      >
        {(field) => {
          const errors = field.state.meta.errors
          const showError = errors.length > 0 && field.state.meta.isTouched
          return (
            <div className="field">
              <label className="field-label" htmlFor="moisture_threshold">
                Ambang kelembapan tanah
              </label>
              <div className="field-input-row">
                <input
                  id="moisture_threshold"
                  name={field.name}
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="demo-input demo-input-fit field-input num"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) =>
                    field.handleChange(
                      e.target.value === '' ? Number.NaN : Number(e.target.value),
                    )
                  }
                  aria-invalid={showError}
                  aria-describedby={showError ? 'threshold-error' : 'threshold-help'}
                />
                <span className="field-unit">%</span>
              </div>
              <p className="field-help" id="threshold-help">
                0–100. Semakin kecil, pompa akan dianggap perlu menyala lebih cepat.
              </p>
              {showError ? (
                <p className="field-error" id="threshold-error" role="alert">
                  {String(errors[0]?.message ?? 'Nilai tidak valid')}
                </p>
              ) : null}
            </div>
          )
        }}
      </form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!canSubmit || isSubmitting || saving}
          >
            {isSubmitting || saving ? 'Menyimpan…' : 'Simpan pengaturan'}
          </button>
        )}
      </form.Subscribe>
    </form>
  )
}
