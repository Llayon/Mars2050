'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { ToastProvider } from '@/components/ui/toast'
import { AuthModal } from '@/components/game/AuthModal'
import type { GameShellProps } from '@/components/game/GameShell'

const GameShell = dynamic<GameShellProps>(() => import('@/components/game/GameShell').then(mod => mod.GameShell), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <p>Загрузка колонии...</p>
    </div>
  )
})

function GameUI() {
  const { user, colonyId, loading, error: authError, login, signup, logout, isTWA, tgUser } = useAuth()

  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <p>Загрузка Mars2050...</p>
      </div>
    )
  }

  // In TWA context — never show email auth form
  if (isTWA && !user && !colonyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
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

  if (!user && !colonyId) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="bg-gray-800 p-4 shadow-lg">
          <div className="container mx-auto">
            <h1 className="text-2xl font-bold text-center">🚀 Mars2050 — Колонизация Марса</h1>
          </div>
        </header>
        <main className="container mx-auto p-4">
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <h2 className="text-4xl font-bold mb-4">Добро пожаловать в Mars2050!</h2>
            <p className="text-xl text-gray-300 mb-8">Браузерная стратегия по колонизации Марса</p>
            <div className="space-x-4">
              <button onClick={() => setAuthMode('login')} className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded-lg text-lg">Войти</button>
              <button onClick={() => setAuthMode('register')} className="bg-green-600 hover:bg-green-700 px-8 py-3 rounded-lg text-lg">Регистрация</button>
            </div>
          </div>
        </main>
        <AuthModal open={authMode !== null} onClose={() => setAuthMode(null)} mode={authMode || 'login'} onModeSwitch={setAuthMode} onSubmit={authMode === 'login' ? login : signup} />
      </div>
    )
  }

  return (
    <GameShell
      user={user}
      colonyId={colonyId!}
      tgUser={tgUser}
      isTWA={isTWA}
      onLogout={logout}
    />
  )
}

export default function Home() {
  return (
    <ToastProvider>
      <GameUI />
    </ToastProvider>
  )
}
