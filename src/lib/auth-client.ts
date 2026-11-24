import { createAuthClient } from 'better-auth/react'
import { inferAdditionalFields, usernameClient } from 'better-auth/client/plugins'
import { env } from '../env.js'

// Field role ditambahkan di backend lewat user.additionalFields —
// dideklarasikan manual di sini agar terekspos di tipe session.
export const authClient = createAuthClient({
  baseURL: env.VITE_API_URL,
  plugins: [
    usernameClient(),
    inferAdditionalFields({
      user: { role: { type: 'string', defaultValue: 'user', input: false } },
    }),
  ],
})

export type SessionUser = {
  id: string
  name: string
  email: string
  image: string | null
  role: 'user' | 'admin'
}

export async function getSessionSafe() {
  try {
    const { data } = await authClient.getSession()
    return data ?? null
  } catch {
    return null
  }
}
