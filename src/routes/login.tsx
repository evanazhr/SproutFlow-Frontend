import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { getSessionSafe, authClient } from '../lib/auth-client'

export const Route = createFileRoute('/login')({
  ssr: false,
  beforeLoad: async () => {
    const session = await getSessionSafe()
    if (session?.user) throw redirect({ to: '/dashboard' })
  },
  component: LoginPage,
})

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path fill="#EA4335" d="M12 5.04c1.62 0 3.06.56 4.2 1.64l3.12-3.12C17.46 1.8 14.96.75 12 .75 7.6.75 3.8 3.27 1.96 6.96l3.66 2.84C6.5 7.02 8.98 5.04 12 5.04Z" />
      <path fill="#4285F4" d="M23.25 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.29 1.48-1.14 2.77-2.4 3.68l3.68 2.85c2.15-1.99 3.5-4.92 3.5-8.77Z" />
      <path fill="#FBBC05" d="M5.62 14.2a7.06 7.06 0 0 1 0-4.4L1.96 6.96a11.26 11.26 0 0 0 0 10.08l3.66-2.84Z" />
      <path fill="#34A853" d="M12 23.25c3.04 0 5.6-1 7.46-2.72l-3.68-2.85c-1.02.69-2.33 1.1-3.78 1.1-3.02 0-5.5-1.98-6.38-4.58l-3.66 2.84c1.84 3.69 5.64 6.21 10.04 6.21Z" />
    </svg>
  )
}

type Mode = 'signin' | 'signup'

function friendlyAuthError(message?: string | null) {
  const m = (message ?? '').toLowerCase()
  if (!m) return 'Terjadi kesalahan. Coba lagi.'
  if (m.includes('invalid email or password') || m.includes('invalid password') || m.includes('credential'))
    return 'Email/username atau password salah.'
  if (m.includes('user already exists') || m.includes('email already') || m.includes('already exists'))
    return 'Email atau username sudah terdaftar. Coba masuk.'
  if (m.includes('username') && m.includes('invalid')) return 'Username tidak valid. Gunakan huruf, angka, titik, atau garis bawah.'
  if (m.includes('password') && (m.includes('short') || m.includes('least'))) return 'Password terlalu pendek. Minimal 8 karakter.'
  if (m.includes('network') || m.includes('fetch') || m.includes('failed to fetch'))
    return 'Tidak bisa terhubung ke server. Periksa koneksi dan alamat API.'
  return message || 'Terjadi kesalahan. Coba lagi.'
}

function PasswordField({ name, label, autoComplete, value, onChange, show, onToggle, placeholder }: {
  name: string; label: string; autoComplete: string; value: string; onChange: (v: string) => void; show: boolean; onToggle: () => void; placeholder: string
}) {
  return (
    <label className="login-field">
      <span className="login-label">{label}</span>
      <div className="password-wrap">
        <input
          name={name}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          minLength={8}
          className="demo-input password-input"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="password-toggle" onClick={onToggle} aria-label={show ? 'Sembunyikan password' : 'Lihat password'}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  )
}

function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const switchMode = (next: Mode) => {
    setMode(next); setError(null); setInfo(null)
    setPassword(''); setConfirmPassword(''); setShowPassword(false); setShowConfirm(false)
  }

  const submitPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null); setInfo(null)
    if (mode === 'signup' && password !== confirmPassword) {
      setError('Konfirmasi password tidak sama. Pastikan kedua password sama persis.')
      return
    }
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const identifier = String(fd.get('identifier') ?? '').trim()
    const name = String(fd.get('name') ?? '').trim()
    const email = String(fd.get('email') ?? '').trim()
    const username = String(fd.get('username') ?? '').trim()
    try {
      if (mode === 'signup') {
        const { error: err } = await authClient.signUp.email({ name, email, password, username: username || undefined })
        if (err) { setError(friendlyAuthError(err.message)); return }
        setInfo('Akun berhasil dibuat. Mengarahkan…')
        window.location.href = '/dashboard'
        return
      }
      const isEmail = identifier.includes('@')
      const { error: err } = isEmail
        ? await authClient.signIn.email({ email: identifier, password })
        : await authClient.signIn.username({ username: identifier, password })
      if (err) { setError(friendlyAuthError(err.message)); return }
      window.location.href = '/dashboard'
    } catch {
      setError('Tidak bisa terhubung ke server. Pastikan backend berjalan dan alamat API benar.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = () => {
    setLoading(true); setError(null); setInfo(null)
    authClient.signIn.social({
      provider: 'google',
      callbackURL: `${window.location.origin}/dashboard`,
      fetchOptions: { onError: (ctx) => { setError(friendlyAuthError(ctx.error.message)); setLoading(false) } },
    })
  }

  return (
    <main className="login-center">
      <section className="login-shell rise-in">
        <svg className="login-logo" viewBox="0 0 24 24" width="44" height="44" aria-hidden="true">
          <path d="M12 21c-4.4 0-7.5-2.9-7.5-7 0-4.6 4.2-7.7 7.2-9.9a.6.6 0 0 1 .6 0c3 2.2 7.2 5.3 7.2 9.9 0 4.1-3.1 7-7.5 7Z" fill="var(--leaf-tint)" stroke="var(--leaf)" strokeWidth="1.5" />
          <path d="M12 21V9m0 4.5c1.8 0 3.2-1.4 3.2-3.2M12 15c-1.8 0-3.2-1.4-3.2-3.2" stroke="var(--leaf)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
        <h1 className="login-title">{mode === 'signin' ? 'Masuk ke SproutFlow' : 'Buat akun SproutFlow'}</h1>
        <p className="login-desc">
          {mode === 'signin' ? 'Pantau dan kontrol tanamanmu. Masuk dengan email/username atau Google.' : 'Daftar untuk mulai memantau dan mengontrol tanamanmu.'}
        </p>

        <form className="login-form" onSubmit={submitPassword} noValidate>
          {mode === 'signup' ? (
            <>
              <label className="login-field"><span className="login-label">Nama</span><input name="name" type="text" autoComplete="name" required className="demo-input" placeholder="Nama kamu" /></label>
              <label className="login-field"><span className="login-label">Email</span><input name="email" type="email" autoComplete="email" required className="demo-input" placeholder="nama@contoh.com" /></label>
              <label className="login-field"><span className="login-label">Username</span><input name="username" type="text" autoComplete="username" required className="demo-input" placeholder="nama_pengguna" /></label>
            </>
          ) : (
            <label className="login-field"><span className="login-label">Email atau username</span><input name="identifier" type="text" autoComplete="username" required className="demo-input" placeholder="nama@contoh.com atau username" /></label>
          )}

          <PasswordField name="password" label="Password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={setPassword} show={showPassword} onToggle={() => setShowPassword((v) => !v)} placeholder="Minimal 8 karakter" />
          {mode === 'signup' ? <PasswordField name="confirmPassword" label="Konfirmasi password" autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} show={showConfirm} onToggle={() => setShowConfirm((v) => !v)} placeholder="Ulangi password" /> : null}

          {mode === 'signup' && confirmPassword.length > 0 && password !== confirmPassword ? <p className="field-msg field-msg-error" role="status">Password belum sama.</p> : null}
          {mode === 'signup' && confirmPassword.length > 0 && password === confirmPassword ? <p className="field-msg field-msg-ok" role="status">Password sudah sama.</p> : null}

          <button type="submit" className="btn btn-primary login-submit" disabled={loading}>{loading ? 'Memproses…' : mode === 'signin' ? 'Masuk' : 'Buat akun'}</button>
        </form>

        <div className="login-divider" role="separator"><span>atau</span></div>
        <button type="button" className="login-google-btn" onClick={handleGoogle} disabled={loading}><GoogleIcon />{loading ? 'Menyiapkan Google…' : 'Masuk dengan Google'}</button>

        {error ? <p className="login-error" role="alert">{error}</p> : null}
        {info ? <p className="login-info" role="status">{info}</p> : null}

        <p className="login-note">
          {mode === 'signin' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
          <button type="button" className="login-switch" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Buat akun' : 'Masuk'}</button>
        </p>
      </section>
    </main>
  )
}
