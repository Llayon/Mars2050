'use client'

import { useState, useEffect, useCallback } from 'react'
import WebApp from '@twa-dev/sdk'
import type { WebAppUser } from '@twa-dev/types'

interface TelegramAuthState {
  colonyId: string | null
  loading: boolean
  error: string | null
  isTWA: boolean
  tgUser: { id: number; first_name: string; username?: string } | null
}

function detectTWA(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return !!WebApp.initData
  } catch {
    return false
  }
}

function requestFullscreen(): void {
  if (!WebApp.requestFullscreen) {
    WebApp.expand()
    return
  }
  try {
    WebApp.requestFullscreen()
  } catch {
    WebApp.expand()
  }
}

export function useTelegramAuth(): TelegramAuthState {
  const [state, setState] = useState<TelegramAuthState>({
    colonyId: null,
    loading: true,
    error: null,
    isTWA: false,
    tgUser: null,
  })

  const login = useCallback(async () => {
    try {
      if (!WebApp.initData) {
        setState(prev => ({ ...prev, loading: false, error: 'Telegram WebApp not available' }))
        return
      }

      WebApp.ready()
      requestFullscreen()

      const tgUser = (WebApp.initDataUnsafe?.user as WebAppUser | undefined) ?? null
      const user = tgUser ? { id: tgUser.id, first_name: tgUser.first_name, username: tgUser.username } : null
      setState(prev => ({ ...prev, isTWA: true, tgUser: user }))

      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: WebApp.initData }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Telegram auth failed')

      setState(prev => ({ ...prev, colonyId: data.colonyId, loading: false }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Telegram auth failed',
        loading: false,
      }))
    }
  }, [])

  useEffect(() => {
    if (detectTWA()) {
      login()
    } else {
      setState(prev => ({ ...prev, loading: false }))
    }
  }, [login])

  return state
}
