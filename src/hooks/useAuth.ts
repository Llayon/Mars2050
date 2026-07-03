'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTelegramAuth } from './useTelegramAuth'

interface AuthUser { id: string; email?: string }
interface AuthState {
  user: AuthUser | null; colonyId: string | null; loading: boolean
  error: string | null; isTWA: boolean; tgUser: { id: number; first_name: string; username?: string } | null
}

const e2eAuthBypass = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === '1'
const getE2eTwaMode = () => typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('e2e_twa') === '1' || window.innerWidth < 768)

export function useAuth() {
  const telegram = useTelegramAuth()
  const [state, setState] = useState<AuthState>({
    user: null, colonyId: null, loading: true, error: null, isTWA: false, tgUser: null
  })

  const formatError = (err: unknown) => {
    const m = String(err)
    return m.includes('Failed to fetch') || m.includes('NetworkError') || m.includes('ERR_NAME_NOT_RESOLVED')
      ? 'Сервер Supabase недоступен. Возможно, проект приостановлен — восстановите его в дашборде Supabase.' : m
  }

  useEffect(() => {
    if (!e2eAuthBypass) return
    let cancelled = false
    async function loadE2eSession() {
      try {
        const res = await fetch('/api/e2e/session')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error?.message || 'E2E auth bypass failed')
        if (!cancelled) setState({ user: data.user, colonyId: data.colonyId, loading: false, error: null, isTWA: getE2eTwaMode(), tgUser: null })
      } catch (error) {
        if (!cancelled) setState(prev => ({ ...prev, loading: false, error: formatError(error) }))
      }
    }
    void loadE2eSession()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (e2eAuthBypass) return
    if (telegram.isTWA) {
      setState(prev => ({ ...prev, colonyId: telegram.colonyId ?? prev.colonyId, loading: telegram.loading, error: telegram.error, isTWA: true, tgUser: telegram.tgUser ?? prev.tgUser }))
    } else if (!telegram.loading) {
      setState(prev => prev.loading ? { ...prev, loading: false } : prev)
    }
  }, [telegram.colonyId, telegram.loading, telegram.error, telegram.isTWA, telegram.tgUser])

  useEffect(() => {
    if (e2eAuthBypass) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
        document.cookie = `supabase-access-token=${session.access_token}; path=/; max-age=${session.expires_in}; SameSite=Lax${secure}`
      } else {
        document.cookie = `supabase-access-token=; path=/; max-age=0`
      }
      setState(prev => {
        if (session?.user && !prev.colonyId) loadColony(session.user.id)
        return { ...prev, user: session?.user ?? null }
      })
    })
    checkSession()
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setState(prev => ({ ...prev, user: session.user }))
        await loadColony(session.user.id)
      }
    } catch (error) {
      setState(prev => ({ ...prev, error: formatError(error) }))
    } finally {
      setState(prev => ({ ...prev, loading: (prev.isTWA || telegram.loading) ? prev.loading : false }))
    }
  }

  async function loadColony(userId: string) {
    try {
      const res = await fetch('/api/colonies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
      if (!res.ok) return setState(prev => ({ ...prev, error: 'Ошибка сервера при создании/загрузке колонии' }))
      const data = await res.json()
      setState(prev => ({ ...prev, colonyId: data.colonyId || null, error: data.colonyId ? null : (data.error || 'Failed to get colony') }))
    } catch (error) {
      setState(prev => ({ ...prev, error: formatError(error) }))
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if ((error.message ?? '').includes('Failed to fetch') || error.status === 0)
        throw new Error('Сервер Supabase недоступен. Возможно, проект приостановлен.')
      throw error
    }
  }, [])

  const signup = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })
    if (error) {
      if ((error.message ?? '').includes('Failed to fetch') || error.status === 0)
        throw new Error('Ошибка подключения к серверу. Проверьте подключение к интернету.')
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    if (e2eAuthBypass) {
      setState({ user: null, colonyId: null, loading: false, error: null, isTWA: false, tgUser: null })
      return
    }
    await supabase.auth.signOut()
    document.cookie = `supabase-access-token=; path=/; max-age=0`
    try { sessionStorage.removeItem('mars2050_tg_user') } catch {}
    setState({ user: null, colonyId: null, loading: false, error: null, isTWA: false, tgUser: null })
  }, [])

  return { ...state, login, signup, logout }
}
