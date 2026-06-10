'use client'

import { useState, useEffect, useCallback } from 'react'
import type { WebAppUser } from '@twa-dev/types'

// Lazy reference — loaded dynamically to avoid SSR crash (@twa-dev/sdk accesses `window` at import time)
type TwaWebApp = typeof import('@twa-dev/sdk').default
let _webApp: TwaWebApp | null = null

async function getWebApp(): Promise<TwaWebApp | null> {
  if (typeof window === 'undefined') return null
  if (!_webApp) {
    try {
      const mod = await import('@twa-dev/sdk')
      _webApp = mod.default
    } catch {
      return null
    }
  }
  return _webApp
}


interface TelegramAuthState {
  colonyId: string | null
  loading: boolean
  error: string | null
  isTWA: boolean
  tgUser: { id: number; first_name: string; username?: string } | null
}

function requestFullscreen(webApp: TwaWebApp): void {
  // expand() maximizes the web app viewport height (works on all versions)
  webApp.expand()

  // requestFullscreen() enters immersive fullscreen (requires Telegram 8.0+)
  if (typeof webApp.requestFullscreen === 'function') {
    // Small delay to let Telegram process the ready/expand events first
    setTimeout(() => {
      try {
        webApp.requestFullscreen()
      } catch {
        // Already expanded via expand(), fullscreen not supported — ignore
      }
    }, 100)
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
      const webApp = await getWebApp()
      if (!webApp?.initData) {
        setState(prev => ({ ...prev, loading: false, error: 'Telegram WebApp not available' }))
        return
      }

      webApp.ready()
      requestFullscreen(webApp)

      const tgUser = (webApp.initDataUnsafe?.user as WebAppUser | undefined) ?? null
      const user = tgUser ? { id: tgUser.id, first_name: tgUser.first_name, username: tgUser.username } : null
      setState(prev => ({ ...prev, isTWA: true, tgUser: user }))

      const res = await fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: webApp.initData }),
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
    // Load @twa-dev/sdk dynamically, then detect TWA environment
    getWebApp().then(webApp => {
      if (webApp?.initData) {
        login()
      } else {
        setState(prev => ({ ...prev, loading: false }))
      }
    })
  }, [login])

  return state
}
