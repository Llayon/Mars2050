'use client'

import { useEffect } from 'react'

export interface E2eAuthUser {
  id: string
  email?: string
}

export interface E2eAuthSession {
  user: E2eAuthUser
  colonyId: string
  isTWA: boolean
}

export const e2eAuthBypass = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === '1'

function getE2eTwaMode(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('e2e_twa') === '1' || window.innerWidth < 768
}

export function useE2eAuthSession(
  onSession: (session: E2eAuthSession) => void,
  onError: (error: unknown) => void
) {
  useEffect(() => {
    if (!e2eAuthBypass) return
    let cancelled = false

    async function loadE2eSession() {
      try {
        const res = await fetch('/api/e2e/session')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error?.message || 'E2E auth bypass failed')
        if (!cancelled) {
          onSession({ user: data.user, colonyId: data.colonyId, isTWA: getE2eTwaMode() })
        }
      } catch (error) {
        if (!cancelled) onError(error)
      }
    }

    void loadE2eSession()
    return () => { cancelled = true }
  }, [onError, onSession])
}
