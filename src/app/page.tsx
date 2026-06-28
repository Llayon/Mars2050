'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useColony } from '@/hooks/useColony'
import { useResources } from '@/hooks/useResources'
import { useBuildings } from '@/hooks/useBuildings'
import { useEvents } from '@/hooks/useEvents'
import { usePopulation } from '@/hooks/usePopulation'
import { ToastProvider, useToast } from '@/components/ui/toast'
import { AuthModal } from '@/components/game/AuthModal'
import type { TabId } from '@/components/screens/BottomNav'
import type { BuildingTypeKey } from '@/domains/building/building.types'
import { TwaHud } from '@/components/game/TwaHud'
import { DesktopHud } from '@/components/game/DesktopHud'

function GameUI() {
  const { user, colonyId, loading, error: authError, login, signup, logout, isTWA } = useAuth()
  const { colony, loading: colonyLoading } = useColony(colonyId)
  const { resources, loading: resourcesLoading } = useResources(colonyId)
  const { buildings, buildStructure, demolishBuilding } = useBuildings(colonyId)
  const { toast } = useToast()
  const { createEvent } = useEvents(colonyId)
  const { population, upgradeTier, loading: populationLoading } = usePopulation(colonyId)

  const [authMode, setAuthMode] = useState<'login' | 'register' | null>(null)
  const [activeTab, setActiveTab] = useState<TabId>('colony')
  const [viewMode, setViewMode] = useState<'classic' | 'isometric'>('isometric')
  const [placementMode, setPlacementMode] = useState<BuildingTypeKey | null>(null)

  const handleBuild = useCallback(async (type: BuildingTypeKey, x?: number, y?: number) => {
    if (x !== undefined && y !== undefined) {
      await buildStructure(type, x, y)
    } else {
      if (viewMode === 'isometric') {
        setPlacementMode(type)
        if (isTWA) setActiveTab('colony')
      } else {
        await buildStructure(type, 10, 10)
      }
    }
  }, [buildStructure, isTWA, viewMode])
  const handleDemolish = useCallback((id: string) => demolishBuilding(id), [demolishBuilding])
  const handleCreateTest = useCallback((id: string, type: string, dur: number) => createEvent(id, type, dur), [createEvent])

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

  if (isTWA) {
    return (
      <TwaHud 
        colonyId={colonyId!}
        colony={colony}
        colonyLoading={colonyLoading}
        buildings={buildings}
        resources={resources}
        resourcesLoading={resourcesLoading}
        userEmail={user?.email}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        placementMode={placementMode}
        setPlacementMode={setPlacementMode}
        onBuild={handleBuild}
        onDemolish={handleDemolish}
        onLogout={logout}
        population={population}
        populationLoading={populationLoading}
        onUpgradePopulation={upgradeTier}
      />
    )
  }

  return (
    <DesktopHud 
      colonyId={colonyId!}
      colony={colony}
      colonyLoading={colonyLoading}
      buildings={buildings}
      resources={resources}
      resourcesLoading={resourcesLoading}
      userEmail={user?.email}
      viewMode={viewMode}
      setViewMode={setViewMode}
      placementMode={placementMode}
      setPlacementMode={setPlacementMode}
      onBuild={handleBuild}
      onDemolish={handleDemolish}
      onCreateTestEvent={handleCreateTest}
      onPvpResult={(msg) => toast(msg, 'info')}
      onLogout={logout}
      population={population}
      populationLoading={populationLoading}
      onUpgradePopulation={upgradeTier}
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
