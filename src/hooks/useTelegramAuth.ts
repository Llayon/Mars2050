'use client'

import { useState, useEffect, useCallback } from 'react'

interface TelegramAuthState {
  colonyId: string | null
  loading: boolean
  error: string | null
  isTWA: boolean
  tgUser: { id: number; first_name: string; username?: string } | null
}

type TelegramWindow = Record<string, Record<string, unknown> | undefined>

function detectTWA(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const tw = (window as unknown as TelegramWindow).Telegram as Record<string, unknown> | undefined
    return !!(tw?.WebApp as Record<string, unknown> | undefined)?.initData
  } catch {
    return false
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
      const tg = (window as unknown as TelegramWindow).Telegram as Record<string, unknown> | undefined
      const WebApp = tg?.WebApp as {
        initData?: string
        initDataUnsafe?: { user?: { id: number; first_name: string; username?: string } }
        ready?: () => void
        expand?: () => void
      } | undefined

      if (!WebApp?.initData) {
        setState(prev => ({ ...prev, loading: false, error: 'Telegram WebApp not available' }))
        return
      }

      WebApp.ready?.()
      WebApp.expand?.()

      const tgUser = WebApp.initDataUnsafe?.user || null
      setState(prev => ({ ...prev, isTWA: true, tgUser }))

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
