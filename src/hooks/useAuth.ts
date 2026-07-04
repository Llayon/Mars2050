'use client'
import { useState, useEffect, useCallback } from 'react'
import { getBrowserSupabase, type BrowserSupabase } from '@/lib/browser-supabase'
import { formatAuthError, loadAuthResume, syncSupabaseAccessTokenCookie } from '@/lib/auth-resume-client'
import { getCachedColonyId, setCachedColonyId } from '@/lib/colony-id-cache'
import { useTelegramAuth } from './useTelegramAuth'

interface AuthUser { id: string; email?: string }
interface AuthState { user: AuthUser | null; colonyId: string | null; loading: boolean; error: string | null; isTWA: boolean; tgUser: { id: number; first_name: string; username?: string } | null }

const e2eAuthBypass = process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === '1'
const getE2eTwaMode = () => typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('e2e_twa') === '1' || window.innerWidth < 768)

export function useAuth() {
  const telegram = useTelegramAuth(!e2eAuthBypass)
  const [state, setState] = useState<AuthState>({ user: null, colonyId: null, loading: true, error: null, isTWA: false, tgUser: null })

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
        if (!cancelled) setState(prev => ({ ...prev, loading: false, error: formatAuthError(error) }))
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
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    async function initSupabaseAuth() {
      try {
        const resumed = await loadAuthResume()
        if (cancelled) return
        if (resumed) {
          setCachedColonyId(resumed.user.id, resumed.colonyId)
          setState({ user: resumed.user, colonyId: resumed.colonyId, loading: false, error: null, isTWA: false, tgUser: null })
          return
        }

        const supabase = await getBrowserSupabase()
        if (cancelled) return

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          syncSupabaseAccessTokenCookie(session)
          setState(prev => {
            if (session?.user && !prev.colonyId) loadColony(session.user.id)
            return { ...prev, user: session?.user ?? null }
          })
        })
        unsubscribe = () => subscription.unsubscribe()
        await checkSession(supabase)
      } catch (error) {
        if (!cancelled) setState(prev => ({ ...prev, loading: false, error: formatAuthError(error) }))
      }
    }

    void initSupabaseAuth()
    return () => { cancelled = true; unsubscribe?.() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkSession(supabase: BrowserSupabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        syncSupabaseAccessTokenCookie(session)
        setState(prev => ({ ...prev, user: session.user }))
        const cachedColonyId = getCachedColonyId(session.user.id)
        if (cachedColonyId) {
          setState(prev => ({ ...prev, colonyId: cachedColonyId, error: null, loading: false }))
          void loadColony(session.user.id)
        } else {
          await loadColony(session.user.id)
        }
      }
    } catch (error) {
      setState(prev => ({ ...prev, error: formatAuthError(error) }))
    } finally {
      setState(prev => ({ ...prev, loading: (prev.isTWA || telegram.loading) ? prev.loading : false }))
    }
  }

  async function loadColony(userId: string) {
    try {
      const res = await fetch('/api/colonies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) })
      if (!res.ok) return setState(prev => ({ ...prev, error: 'Ошибка сервера при создании/загрузке колонии' }))
      const data = await res.json()
      if (data.colonyId) setCachedColonyId(userId, data.colonyId)
      setState(prev => ({ ...prev, colonyId: data.colonyId || null, error: data.colonyId ? null : (data.error || 'Failed to get colony') }))
    } catch (error) {
      setState(prev => ({ ...prev, error: formatAuthError(error) }))
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    const supabase = await getBrowserSupabase()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if ((error.message ?? '').includes('Failed to fetch') || error.status === 0)
        throw new Error('Сервер Supabase недоступен. Возможно, проект приостановлен.')
      throw error
    }
  }, [])

  const signup = useCallback(async (email: string, password: string) => {
    const supabase = await getBrowserSupabase()
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
    const supabase = await getBrowserSupabase()
    await supabase.auth.signOut()
    syncSupabaseAccessTokenCookie(null)
    try { sessionStorage.removeItem('mars2050_tg_user') } catch {}
    setState({ user: null, colonyId: null, loading: false, error: null, isTWA: false, tgUser: null })
  }, [])

  return { ...state, login, signup, logout }
}
