'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useTelegramAuth } from './useTelegramAuth'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  colonyId: string | null
  loading: boolean
  error: string | null
  isTWA: boolean
  tgUser: { id: number; first_name: string; username?: string } | null
}

export function useAuth() {
  const telegram = useTelegramAuth()

  const [state, setState] = useState<AuthState>({
    user: null,
    colonyId: null,
    loading: true,
    error: null,
    isTWA: false,
    tgUser: null,
  })

  // Sync TWA state from useTelegramAuth
  useEffect(() => {
    if (telegram.isTWA) {
      setState(prev => ({
        ...prev,
        colonyId: telegram.colonyId ?? prev.colonyId,
        loading: telegram.loading,
        error: telegram.error,
        isTWA: true,
        tgUser: telegram.tgUser ?? prev.tgUser,
      }))
    } else if (!telegram.loading) {
      // TWA detection finished (not a TWA or failed) — ensure loading is false
      setState(prev => (prev.loading ? { ...prev, loading: false } : prev))
    }
  }, [telegram.colonyId, telegram.loading, telegram.error, telegram.isTWA, telegram.tgUser])

  // Always subscribe to auth state changes (works for both web and TWA after signInWithPassword)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
        document.cookie = `supabase-access-token=${session.access_token}; path=/; max-age=${session.expires_in}; SameSite=Lax${secure}`
      } else {
        document.cookie = `supabase-access-token=; path=/; max-age=0`
      }
      setState(prev => {
        // Load colony when user signs in and colonyId not yet set
        if (session?.user && !prev.colonyId) {
          loadColony(session.user.id)
        }
        return { ...prev, user: session?.user ?? null }
      })
    })

    // Check existing session on mount
    checkSession()

    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatError = (err: unknown) => {
    const m = String(err)
    return m.includes('Failed to fetch') || m.includes('NetworkError') || m.includes('ERR_NAME_NOT_RESOLVED')
      ? 'Сервер Supabase недоступен. Возможно, проект приостановлен — восстановите его в дашборде Supabase.' : m
  }

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
      const res = await fetch('/api/colonies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
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
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) {
      if ((error.message ?? '').includes('Failed to fetch') || error.status === 0)
        throw new Error('Ошибка подключения к серверу. Проверьте подключение к интернету.')
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    document.cookie = `supabase-access-token=; path=/; max-age=0`
    try { sessionStorage.removeItem('mars2050_tg_user') } catch { /* ignore */ }
    setState({ user: null, colonyId: null, loading: false, error: null, isTWA: false, tgUser: null })
  }, [])

  return { ...state, login, signup, logout }
}
