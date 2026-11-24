import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import ThemeToggle from './ThemeToggle'
import { authClient } from '../lib/auth-client'
import { disconnectMqtt } from '../lib/mqtt'
import { useAuth } from '../hooks/useAuth'

function BrandMark() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M12 21c-4.4 0-7.5-2.9-7.5-7 0-4.6 4.2-7.7 7.2-9.9a.6.6 0 0 1 .6 0c3 2.2 7.2 5.3 7.2 9.9 0 4.1-3.1 7-7.5 7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M12 21V9m0 4.5c1.8 0 3.2-1.4 3.2-3.2M12 15c-1.8 0-3.2-1.4-3.2-3.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

export default function Header() {
  const { user, isAdmin, isPending } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [signingOut, setSigningOut] = useState(false)

  const handleLogout = async () => {
    setSigningOut(true)
    try {
      await authClient.signOut()
    } finally {
      disconnectMqtt()
      queryClient.clear()
      await navigate({ to: '/login' })
      setSigningOut(false)
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--header-bg)] px-4 backdrop-blur-lg">
      <nav className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
        <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/dashboard"
            className="brand-link inline-flex items-center gap-2 no-underline"
            aria-label="SproutFlow — ke dashboard"
          >
            <span className="brand-mark">
              <BrandMark />
            </span>
            <span className="brand-name">SproutFlow</span>
          </Link>
        </h2>

        {user ? (
          <div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-none sm:w-auto sm:flex-nowrap sm:pb-0">
            <Link to="/dashboard" className="nav-link" activeProps={{ className: 'nav-link is-active' }}>
              Dashboard
            </Link>
            <Link to="/history" className="nav-link" activeProps={{ className: 'nav-link is-active' }}>
              Riwayat
            </Link>
            <Link to="/settings" className="nav-link" activeProps={{ className: 'nav-link is-active' }}>
              Pengaturan
            </Link>
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {isPending ? (
            <span className="skel skel-header-user" aria-hidden="true" />
          ) : user ? (
            <div className="flex items-center gap-2">
              {user.image ? (
                <img src={user.image} alt="" width={30} height={30} className="user-avatar" />
              ) : (
                <span className="user-avatar user-avatar-fallback" aria-hidden="true">
                  {(user.name ?? '?').slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="user-name hidden sm:inline">{user.name}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleLogout} disabled={signingOut}>
                {signingOut ? 'Keluar…' : 'Keluar'}
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm no-underline">
              Masuk
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
