'use client'

import dynamic from 'next/dynamic'
import { useCallback, useState } from 'react'

const AuthModal = dynamic(() => import('@/components/game/AuthModal').then(mod => mod.AuthModal), {
  ssr: false,
  loading: () => null,
})

type AuthMode = 'login' | 'register'

function formatAuthError(error: unknown): Error {
  if (error instanceof Error) {
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return new Error('Сервер Supabase недоступен. Возможно, проект приостановлен.')
    }
    return error
  }
  return new Error(String(error))
}

export function PublicAuthActions() {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null)

  const handleSubmit = useCallback(async (email: string, password: string) => {
    const { supabase } = await import('@/lib/supabase')
    const result = authMode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/callback` } })

    if (result.error) throw formatAuthError(result.error)
  }, [authMode])

  return (
    <>
      <div className="flex flex-wrap justify-center gap-4">
        <button
          data-testid="public-auth-login"
          onClick={() => setAuthMode('login')}
          className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg text-lg"
        >
          Войти
        </button>
        <button
          data-testid="public-auth-register"
          onClick={() => setAuthMode('register')}
          className="bg-green-600 hover:bg-green-700 px-8 py-3 rounded-lg text-lg"
        >
          Регистрация
        </button>
      </div>
      {authMode && (
        <AuthModal
          open
          onClose={() => setAuthMode(null)}
          mode={authMode}
          onModeSwitch={setAuthMode}
          onSubmit={handleSubmit}
        />
      )}
    </>
  )
}
