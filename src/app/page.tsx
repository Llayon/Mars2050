'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useColony } from '@/hooks/useColony'
import { useResources } from '@/hooks/useResources'
import { useBuildings } from '@/hooks/useBuildings'
import { useEvents } from '@/hooks/useEvents'
import { ToastProvider, useToast } from '@/components/ui/toast'
import { AuthModal } from '@/components/game/AuthModal'
import { ColonyPanel } from '@/components/game/ColonyPanel'
import { ResourcePanel } from '@/components/game/ResourcePanel'
import { GameMapPanel } from '@/components/game/GameMapPanel'
import { BuildingsPanel } from '@/components/game/BuildingsPanel'
import { EventsPanel } from '@/components/game/EventsPanel'
import { LeaderboardPanel } from '@/components/game/LeaderboardPanel'
import { PvpPanel } from '@/components/game/PvpPanel'
import { ArmyPanel } from '@/components/game/ArmyPanel'
import { BottomNav } from '@/components/screens/BottomNav'
import type { TabId } from '@/components/screens/BottomNav'
import ColonyScreen from '@/components/screens/ColonyScreen'
import { BuildingsScreen } from '@/components/screens/BuildingsScreen'
import { MapScreen } from '@/components/screens/MapScreen'
import { OperationsScreen } from '@/components/screens/OperationsScreen'
import { ProfileScreen } from '@/components/screens/ProfileScreen'
import { HudBottomSheet } from '@/components/ui/hud/HudBottomSheet'
import type { BuildingTypeKey } from '@/domains/building/building.types'

function GameUI() {
  const { user, colonyId, loading, error: authError, login, signup, logout, isTWA } = useAuth()
  const { colony, loading: colonyLoading } = useColony(colonyId)
  const { resources, loading: resourcesLoading } = useResources(colonyId)
  const { buildings, buildStructure, demolishBuilding } = useBuildings(colonyId)
  const { toast } = useToast()
  const { createEvent } = useEvents(colonyId)

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

  // Common props for ColonyScreen
  const colonyScreenProps = {
    colony,
    colonyLoading,
    colonyId: colonyId!,
    buildings,
    resources,
    resourcesLoading,
    onLogout: logout,
    onDemolish: handleDemolish,
    onBuild: handleBuild,
    placementMode,
    setPlacementMode
  }

  if (isTWA) {
    return (
      <div className="min-h-[100dvh] bg-black text-white flex flex-col relative overflow-hidden">
        {/* Base layer: Colony Screen is always present */}
        <div className="absolute inset-0 z-0">
          <ColonyScreen {...colonyScreenProps} />
        </div>
        
        {/* Bottom Sheets for other tabs */}
        <HudBottomSheet open={activeTab === 'buildings'} onClose={() => setActiveTab('colony')}>
          <BuildingsScreen
            buildings={buildings}
            colonyId={colonyId!}
            resources={resources}
            resourcesLoading={resourcesLoading}
            onBuild={handleBuild}
            onDemolish={handleDemolish}
          />
        </HudBottomSheet>
        
        <HudBottomSheet open={activeTab === 'map'} onClose={() => setActiveTab('colony')}>
          <MapScreen
            colonyId={colonyId!}
            resources={resources}
            resourcesLoading={resourcesLoading}
          />
        </HudBottomSheet>
        
        <HudBottomSheet open={activeTab === 'operations'} onClose={() => setActiveTab('colony')}>
          <OperationsScreen colonyId={colonyId!} resources={resources} />
        </HudBottomSheet>
        
        <HudBottomSheet open={activeTab === 'profile'} onClose={() => setActiveTab('colony')}>
          <ProfileScreen
            colony={colony}
            colonyLoading={colonyLoading}
            userEmail={user?.email}
          />
        </HudBottomSheet>

        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-black text-white relative overflow-hidden">
      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
        {viewMode === 'isometric' ? (
          <ColonyScreen {...colonyScreenProps} />
        ) : (
          <div className="w-full h-full bg-mars-surface p-4 pt-24 overflow-y-auto">
             <GameMapPanel colonyId={colonyId!} />
          </div>
        )}
      </div>

      {/* Top HUD */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none p-4 flex justify-between items-start">
        {/* Top Left */}
        <div className="w-80 pointer-events-auto space-y-4">
          <ColonyPanel colony={colony} loading={colonyLoading} />
          <ResourcePanel resources={resources} loading={resourcesLoading} />
        </div>
        
        {/* Top Right */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="hud-panel rounded-lg px-4 py-2 flex items-center gap-4">
            <span className="text-sm font-bold text-gray-200">{colony?.name || 'Колония'}</span>
            <span className="text-xs text-mars-gold">Ур. {colony?.level || 1}</span>
            <button onClick={logout} className="text-[10px] uppercase text-red-400 hover:text-red-300 ml-2">
              Выход
            </button>
          </div>
          <div className="hud-panel rounded-lg p-1 flex gap-1 w-48">
             <button 
                onClick={() => setViewMode('isometric')}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all border ${viewMode === 'isometric' ? 'bg-mars-orange border-mars-orange text-white shadow-[0_0_10px_rgba(255,107,0,0.4)]' : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5'}`}
             >
               БАЗА
             </button>
             <button 
                onClick={() => setViewMode('classic')}
                className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all border ${viewMode === 'classic' ? 'bg-mars-orange border-mars-orange text-white shadow-[0_0_10px_rgba(255,107,0,0.4)]' : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5'}`}
             >
               КАРТА
             </button>
          </div>
        </div>
      </div>

      {/* Left HUD panels */}
      <div className="absolute top-48 left-4 bottom-4 w-80 z-10 pointer-events-none overflow-y-auto">
        <div className="pointer-events-auto space-y-4 pb-4">
          <EventsPanel colonyId={colonyId!} onCreateTest={handleCreateTest} />
          <PvpPanel colonyId={colonyId!} onResult={(msg) => toast(msg, 'info')} />
          <ArmyPanel colonyId={colonyId!} resources={resources} />
        </div>
      </div>

      {/* Right HUD panels */}
      <div className="absolute top-24 right-4 bottom-4 w-96 z-10 pointer-events-none overflow-y-auto">
        <div className="pointer-events-auto space-y-4 pb-4">
          <BuildingsPanel
            buildings={buildings}
            resources={resources}
            onBuild={handleBuild}
            onDemolish={handleDemolish}
          />
          <LeaderboardPanel />
        </div>
      </div>
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
