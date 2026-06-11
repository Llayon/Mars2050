'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
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

const TG_USER_KEY = 'mars2050_tg_user'

function saveTgUser(user: { id: number; first_name: string; username?: string }): void {
  try { sessionStorage.setItem(TG_USER_KEY, JSON.stringify(user)) } catch { /* ignore */ }
}

function loadTgUser(): { id: number; first_name: string; username?: string } | null {
  try {
    const raw = sessionStorage.getItem(TG_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

interface TelegramAuthState {
  colonyId: string | null
  loading: boolean
  error: string | null
  isTWA: boolean
  tgUser: { id: number; first_name: string; username?: string } | null
}

function requestFullscreen(webApp: TwaWebApp): void {
  webApp.expand()
  if (typeof webApp.requestFullscreen === 'function') {
    setTimeout(() => {
      try { webApp.requestFullscreen() } catch { /* already expanded */ }
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

  /** Signs into Supabase with credentials returned by the server, establishing a real session */
  const signInSupabase = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(`Supabase session failed: ${error.message}`)
  }, [])

  /** Loads colony via API and sets state */
  const loadColony = useCallback(async (tgUser: { id: number; first_name: string; username?: string }) => {
    const webApp = await getWebApp()
    if (!webApp?.initData) {
      setState(prev => ({ ...prev, loading: false, error: 'Telegram WebApp not available' }))
      return
    }

    webApp.ready()
    requestFullscreen(webApp)

    setState(prev => ({ ...prev, isTWA: true, tgUser }))
    saveTgUser(tgUser)

    const res = await fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: webApp.initData }),
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Telegram auth failed')

    // Establish real Supabase session so RLS reads and realtime work
    if (data.email && data.password) {
      await signInSupabase(data.email, data.password)
    }

    setState(prev => ({ ...prev, colonyId: data.colonyId, loading: false }))
  }, [signInSupabase])

  useEffect(() => {
    async function init() {
      // Check for existing Supabase session (from previous TWA open)
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email?.startsWith('tg_')) {
        // Valid session exists — restore tgUser from sessionStorage and load colony
        const tgUser = loadTgUser()
        setState(prev => ({
          ...prev,
          isTWA: true,
          tgUser,
          loading: false,
          // colonyId will be set by useAuth via onAuthStateChange
        }))
        return
      }

      // No session — detect TWA and authenticate
      const webApp = await getWebApp()
      if (!webApp?.initData) {
        setState(prev => ({ ...prev, loading: false }))
        return
      }

      const tgWebUser = (webApp.initDataUnsafe?.user as WebAppUser | undefined) ?? null
      if (!tgWebUser) {
        setState(prev => ({ ...prev, loading: false, error: 'Telegram user not found in initData' }))
        return
      }

      const tgUser = { id: tgWebUser.id, first_name: tgWebUser.first_name, username: tgWebUser.username }
      try {
        await loadColony(tgUser)
      } catch (err) {
        setState(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Telegram auth failed',
          loading: false,
        }))
      }
    }

    init()
  }, [loadColony])

  return state
}
