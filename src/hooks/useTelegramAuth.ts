'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { hasTelegramWebAppSignal } from '@/lib/telegram-auth-detection'
import type { WebAppUser } from '@twa-dev/types'
type TwaWebApp = typeof import('@twa-dev/sdk').default
let _webApp: TwaWebApp | null = null

async function getWebApp(): Promise<TwaWebApp | null> {
  if (typeof window === 'undefined') return null
  if (!hasTelegramWebAppSignal()) return null
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

function saveTgUser(user: { id: number; first_name: string; username?: string }): void {
  try { sessionStorage.setItem('mars2050_tg_user', JSON.stringify(user)) } catch { /* ignore */ }
}

function loadTgUser(): { id: number; first_name: string; username?: string } | null {
  try {
    const raw = sessionStorage.getItem('mars2050_tg_user')
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

export function useTelegramAuth(enabled = true): TelegramAuthState {
  const [state, setState] = useState<TelegramAuthState>({
    colonyId: null,
    loading: true,
    error: null,
    isTWA: false,
    tgUser: null,
  })

  const signInSupabase = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(`Supabase session failed: ${error.message}`)
  }, [])

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
    if (!res.ok) {
      const errorMsg = data.error?.message || data.error || 'Telegram auth failed'
      throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg))
    }

    // Establish real Supabase session so RLS reads and realtime work
    if (data.email && data.password) {
      await signInSupabase(data.email, data.password)
    }

    setState(prev => ({ ...prev, colonyId: data.colonyId, loading: false }))
  }, [signInSupabase])

  useEffect(() => {
    if (!enabled || !hasTelegramWebAppSignal()) {
      setState(prev => prev.loading ? { ...prev, loading: false } : prev)
      return
    }

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email?.startsWith('tg_')) {
        const tgUser = loadTgUser()
        setState(prev => ({
          ...prev,
          isTWA: true,
          tgUser,
          loading: false,
        }))
        return
      }

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
  }, [enabled, loadColony])

  return state
}
