'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useResources } from '@/hooks/useResources'
import { useBuildings } from '@/hooks/useBuildings'
import { useEvents } from '@/hooks/useEvents'
import { ToastProvider, useToast } from '@/components/ui/toast'
import { AuthModal } from '@/components/game/AuthModal'
import { ResourcePanel } from '@/components/game/ResourcePanel'
import { GameMapPanel } from '@/components/game/GameMapPanel'
import { BuildingsPanel } from '@/components/game/BuildingsPanel'
import { EventsPanel } from '@/components/game/EventsPanel'
import type { BuildingTypeKey } from '@/domains/building/building.types'

function GameUI() {
  const { user, colonyId, loading, login, signup, logout } = useAuth()
  const { resources, loading: resourcesLoading, refetch: refetchResources } = useResources(colonyId)
  const { buildings, buildStructure, demolishBuilding } = useBuildings(colonyId)
  const { toast } = useToast()
  const { createEvent } = useEvents(colonyId)

  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null)

  const handleBuild = useCallback((type: BuildingTypeKey) => buildStructure(type), [buildStructure])
  const handleDemolish = useCallback((id: string) => demolishBuilding(id), [demolishBuilding])
  const handleCreateTest = useCallback((id: string, type: string, dur: number) => createEvent(id, type, dur), [createEvent])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <p>Загрузка Mars2050...</p>
      </div>
    )
  }

  if (!user || !colonyId) {
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
        <AuthModal
          open={authMode !== null}
          onClose={() => setAuthMode(null)}
          mode={authMode || 'login'}
          onModeSwitch={setAuthMode}
          onSubmit={authMode === 'login' ? login : signup}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">🚀 Mars2050</h1>
          <button onClick={logout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm">
            Выйти ({user.email})
          </button>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-4">
            <ResourcePanel resources={resources} loading={resourcesLoading} />
            <EventsPanel colonyId={colonyId} onCreateTest={handleCreateTest} />
          </div>
          <div className="lg:col-span-2">
            <GameMapPanel colonyId={colonyId} onDiscover={refetchResources} />
          </div>
          <div className="lg:col-span-3">
            <BuildingsPanel
              buildings={buildings}
              colonyId={colonyId}
              resources={resources}
              onBuild={handleBuild}
              onDemolish={handleDemolish}
              onRefresh={refetchResources}
            />
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 p-4 mt-8 text-center text-gray-400">
        <p>© 2050 Mars2050 — Стратегия колонизации Марса</p>
      </footer>
    </div>
  )
}

export default function Home() {
  return (
    <ToastProvider>
      <GameUI />
    </ToastProvider>
  )
}