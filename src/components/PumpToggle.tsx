import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Droplets } from 'lucide-react'
import type { PumpCommand, PumpMode } from '../lib/api'

export default function PumpToggle({
  pumpStatus,
  online,
  isAdmin: _isAdmin,
  pumpMode,
  onSend,
}: {
  pumpStatus: PumpCommand
  online: boolean
  isAdmin: boolean
  pumpMode: PumpMode
  onSend: (command: PumpCommand) => void
}) {
  const [confirming, setConfirming] = useState<PumpCommand | null>(null)
  const on = pumpStatus
  const auto = pumpMode === 'auto'

  const openConfirm = (command: PumpCommand) => {
    if (auto) return
    setConfirming(command)
  }

  const submitConfirm = () => {
    if (!confirming) return
    onSend(confirming)
    setConfirming(null)
  }

  const commandLabel = confirming === 'ON' ? 'Nyalakan pompa' : 'Matikan pompa'

  return (
    <section className="pump-panel">
      <header className="pump-head">
        <span className="pump-icon" aria-hidden="true">
          <Droplets size={18} strokeWidth={2.4} />
        </span>
        <div>
          <p className="pump-title">Pompa air</p>
          <p className="pump-sub">
            {auto
              ? 'Mode otomatis — dikendalikan sesuai setpoint'
              : online
                ? 'Perangkat siap menerima perintah'
                : 'Perangkat terdeteksi offline'}
          </p>
        </div>
        <span className={`badge badge-${on === 'ON' ? 'on' : 'off'}`}>
          <span className="badge-dot" aria-hidden="true" />
          {on}
        </span>
      </header>

      <div className="pump-control">
        <button
          type="button"
          role="switch"
          aria-checked={pumpStatus === 'ON'}
          aria-label={`${pumpStatus === 'ON' ? 'Matikan' : 'Nyalakan'} pompa air`}
          className={`pump-switch ${on === 'ON' ? 'is-on' : ''}`}
          disabled={confirming !== null || auto}
          onClick={() => openConfirm(pumpStatus === 'ON' ? 'OFF' : 'ON')}
        >
          <span className="pump-knob" aria-hidden="true">
            {on === 'ON' ? 'ON' : ''}
          </span>
        </button>
        <p className="pump-hint">
          {auto
            ? 'Otomatis: menyala saat kelembapan di bawah setpoint, mati saat tercapai. Ubah di Pengaturan.'
            : pumpStatus === 'ON'
              ? 'Sedang menyala — klik untuk mematikan.'
              : 'Klik untuk menyirami.'}
        </p>
      </div>

      {confirming
        ? createPortal(
            <div
              className="dialog-overlay"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pump-confirm-title"
              onClick={(e) => {
                if (e.target === e.currentTarget) setConfirming(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setConfirming(null)
              }}
            >
              <div className="dialog-card">
                <h2 id="pump-confirm-title" className="dialog-title">
                  {commandLabel}?
                </h2>
                <p className="dialog-desc">
                  Perintah dikirim ke perangkat lewat server. Status pompa langsung diperbarui
                  di dashboard.
                </p>
                <div className="dialog-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setConfirming(null)}
                  >
                    Batal
                  </button>
                  <button type="button" className="btn btn-primary" onClick={submitConfirm}>
                    Ya, kirim
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  )
}
