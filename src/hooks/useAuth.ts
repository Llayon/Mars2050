'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  colonyId: string | null
  loading: boolean
  error: string | null
}

/**
 * Hook for managing authentication and colony state.
 * Auth operations use Supabase client SDK.
 * Colony creation uses API route (server-side mutation).
 */
export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    colonyId: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(prev => ({ ...prev, user: session?.user ?? null }))
      if (session?.user) {
        loadColony(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function checkSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setState(prev => ({ ...prev, user: session.user }))
        await loadColony(session.user.id)
      }
    } catch (error) {
      setState(prev => ({ ...prev, error: String(error) }))
    } finally {
      setState(prev => ({ ...prev, loading: false }))
    }
  }

  async function loadColony(userId: string) {
    try {
      // Read colony via Supabase (RLS-protected)
      const { data: colonies } = await supabase
        .from('colonies')
        .select('id')
        .eq('user_id', userId)
        .limit(1)

      if (colonies && colonies.length > 0) {
        setState(prev => ({ ...prev, colonyId: (colonies[0] as Record<string, unknown>).id as string }))
      } else {
        // Colony doesn't exist — create via API (server-side mutation)
        const res = await fetch('/api/colonies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        })

        const data = await res.json()
        if (data.colonyId) {
          setState(prev => ({ ...prev, colonyId: data.colonyId }))
        } else {
          setState(prev => ({ ...prev, error: data.error || 'Failed to create colony' }))
        }
      }
    } catch (error) {
      setState(prev => ({ ...prev, error: String(error) }))
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signup = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` }
    })
    if (error) throw error
  }, [])

  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setState({ user: null, colonyId: null, loading: false, error: null })
  }, [])

  return { ...state, login, signup, logout }
}