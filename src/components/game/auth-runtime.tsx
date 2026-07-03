'use client'

import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { ToastProvider } from '@/components/ui/toast'
import type { GameShellProps } from '@/components/game/GameShell'

const GameShell = dynamic<GameShellProps>(() => import('@/components/game/GameShell').then(mod => mod.GameShell), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <p>Загрузка колонии...</p>
    </div>
  ),
})

export function AuthRuntime() {
  const { user, colonyId, loading, error: authError, logout, isTWA, tgUser } = useAuth()

  useEffect(() => {
    if (!loading && !isTWA && (!user || !colonyId)) {
      document.documentElement.classList.remove('mars2050-auth-resume')
    }
  }, [loading, user, colonyId, isTWA])

  if (loading) return null

  if (isTWA && !user && !colonyId) {
    return (
      <div className="fixed inset-0 z-50 min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="text-center p-6">
          {authError ? (
            <>
              <p className="text-xl mb-2">Ошибка аутентификации</p>
              <p className="text-sm text-red-400 mb-4">{authError}</p>
              <p className="text-xs text-gray-500">Закройте и откройте Mini App заново</p>
            </>
          ) : (
            <>
              <p className="text-xl mb-2">Загрузка Mars2050...</p>
              <p className="text-sm text-gray-400">Аутентификация через Telegram</p>
            </>
          )}
        </div>
      </div>
    )
  }

  if (!user || !colonyId) return null

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <ToastProvider>
        <GameShell
          user={user}
          colonyId={colonyId}
          tgUser={tgUser}
          isTWA={isTWA}
          onLogout={logout}
        />
      </ToastProvider>
    </div>
  )
}
