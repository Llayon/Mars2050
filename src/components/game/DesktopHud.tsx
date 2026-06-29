'use client'

import { useState } from 'react'
import { ColonyPanel } from '@/components/game/ColonyPanel'
import { ResourcePanel } from '@/components/game/ResourcePanel'
import { GameMapPanel } from '@/components/game/GameMapPanel'
import { BuildingsPanel } from '@/components/game/BuildingsPanel'
import { EventsPanel } from '@/components/game/EventsPanel'
import { LeaderboardPanel } from '@/components/game/LeaderboardPanel'
import { PvpPanel } from '@/components/game/PvpPanel'
import { ArmyPanel } from '@/components/game/ArmyPanel'
import ColonyScreen from '@/components/screens/ColonyScreen'
import type { BuildingTypeKey } from '@/domains/building/building.types'
import type { Colony } from '@/domains/colony/colony.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import type { BuildingRow } from '@/domains/building/building.types'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'
import { PopulationSummary } from '@/components/game/PopulationSummary'

// New HUD Components
import { TopResourceBar } from '@/components/game/hud/TopResourceBar'
import { ActionBottomBar } from '@/components/game/hud/ActionBottomBar'
import { GameAlerts } from '@/components/game/hud/GameAlerts'
import { LegacyPanelsDrawer } from '@/components/game/hud/LegacyPanelsDrawer'

interface DesktopHudProps {
  colonyId: string
  colony: Colony | null
  colonyLoading: boolean
  buildings: BuildingRow[]
  resources: ResourceRow[]
  resourcesLoading: boolean
  userEmail?: string
  viewMode: 'colony' | 'map'
  setViewMode: (mode: 'colony' | 'map') => void
  placementMode: BuildingTypeKey | null
  setPlacementMode: (mode: BuildingTypeKey | null) => void
  onBuild: (type: BuildingTypeKey, x?: number, y?: number) => Promise<void>
  onDemolish: (id: string) => Promise<void>
  onCreateTestEvent: (id: string, type: string, dur: number) => Promise<boolean>
  onPvpResult: (msg: string) => void
  onLogout: () => void
  population: PopulationState | null
  populationLoading?: boolean
  onUpgradePopulation: (fromTier: PopulationTier, count: number) => void
}

export function DesktopHud({
  colonyId,
  colony,
  colonyLoading,
  buildings,
  resources,
  resourcesLoading,
  userEmail,
  viewMode,
  setViewMode,
  placementMode,
  setPlacementMode,
  onBuild,
  onDemolish,
  onCreateTestEvent,
  onPvpResult,
  onLogout,
  population,
  populationLoading,
  onUpgradePopulation
}: DesktopHudProps) {
  
  const [legacyOpen, setLegacyOpen] = useState(false)
  const [buildOpen, setBuildOpen] = useState(false)
  const [armyOpen, setArmyOpen] = useState(false)

  const colonyScreenProps = {
    colony,
    colonyLoading,
    colonyId,
    buildings,
    resources,
    resourcesLoading,
    onLogout,
    onDemolish,
    onBuild,
    placementMode,
    setPlacementMode
  }

  return (
    <div className="min-h-[100dvh] bg-black text-white relative overflow-hidden">
      {/* Background Canvas Layer */}
      <div className="absolute inset-0 z-0">
        <ColonyScreen {...colonyScreenProps} />
        {viewMode === 'map' && (
          <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-md p-4 pt-24 overflow-y-auto pointer-events-auto">
             <GameMapPanel colonyId={colonyId} />
          </div>
        )}
      </div>

      {/* Top HUD */}
      {!placementMode && (
        <TopResourceBar resources={resources} population={population} colony={colony} />
      )}

      {/* Left Alerts */}
      {!placementMode && viewMode === 'colony' && (
        <GameAlerts population={population} />
      )}

      {/* Bottom Command Bar */}
      {!placementMode && (
        <ActionBottomBar 
          activeView={viewMode}
          onViewChange={setViewMode}
          onToggleArmy={() => setArmyOpen(prev => !prev)}
          onToggleBuild={() => setBuildOpen(prev => !prev)}
          onToggleManagement={() => setLegacyOpen(true)}
        />
      )}

      {/* Right Sidebar Placeholder (Build/Leaderboard) */}
      {buildOpen && !placementMode && viewMode === 'colony' && (
        <div className="absolute top-24 right-0 bottom-16 w-96 z-20 pointer-events-none overflow-y-auto animate-slide-in-right">
          <div className="pointer-events-auto space-y-4 pb-4 bg-gray-900/90 backdrop-blur-md p-4 rounded-l-lg border-l border-y border-cyan-500/30 min-h-full shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-white font-bold tracking-wider text-sm">ИНФРАСТРУКТУРА</h3>
               <button onClick={() => setBuildOpen(false)} className="text-gray-400 hover:text-white font-bold">&times;</button>
            </div>
            <BuildingsPanel buildings={buildings} resources={resources} onBuild={onBuild} onDemolish={onDemolish} />
            <LeaderboardPanel />
          </div>
        </div>
      )}

      {/* Army / PvP Entry Point Placeholder (Phase 1) */}
      {armyOpen && !placementMode && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto">
           <div className="bg-gray-900 border border-cyan-500/30 p-6 rounded-lg shadow-[0_0_50px_rgba(6,182,212,0.15)] max-w-md w-full relative">
              <button onClick={() => setArmyOpen(false)} className="absolute top-2 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
              <h2 className="text-xl font-bold text-cyan-400 mb-2">КОМАНДНЫЙ ЦЕНТР</h2>
              <p className="text-gray-400 text-sm mb-6">Развертывание армии и полноэкранный интерфейс PvP находятся в разработке (Phase 2).</p>
              
              <div className="space-y-4">
                 <button className="w-full py-3 bg-cyan-900/40 border border-cyan-500/50 text-cyan-300 rounded hover:bg-cyan-900/60 transition-colors font-bold uppercase text-sm tracking-wider cursor-not-allowed opacity-50">
                   Расстановка войск
                 </button>
                 <button className="w-full py-3 bg-cyan-900/40 border border-cyan-500/50 text-cyan-300 rounded hover:bg-cyan-900/60 transition-colors font-bold uppercase text-sm tracking-wider cursor-not-allowed opacity-50">
                   Найти цель на карте
                 </button>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-700">
                <p className="text-xs text-gray-500 mb-2">Для ручной атаки (Legacy) используйте панель PvP во вкладке &quot;Управление&quot;.</p>
                <button onClick={() => setArmyOpen(false)} className="w-full py-2 bg-slate-800 text-white rounded hover:bg-slate-700 font-bold uppercase text-xs">
                  Закрыть
                </button>
              </div>
           </div>
        </div>
      )}

      {/* Legacy Drawer */}
      <LegacyPanelsDrawer isOpen={legacyOpen} onClose={() => setLegacyOpen(false)}>
        <div className="space-y-6">
          <ColonyPanel colony={colony} loading={colonyLoading} />
          <PopulationSummary population={population} loading={populationLoading} />
          <ResourcePanel resources={resources} loading={resourcesLoading} />
          <EventsPanel colonyId={colonyId} onCreateTest={onCreateTestEvent} />
          <PvpPanel colonyId={colonyId} onResult={onPvpResult} />
          <ArmyPanel colonyId={colonyId} resources={resources} />
        </div>
      </LegacyPanelsDrawer>

      {/* Placement Mode Float */}
      {placementMode && (
        <div className="absolute bottom-12 left-0 right-0 z-20 flex justify-center pointer-events-none">
          <div className="bg-black/80 backdrop-blur border border-cyan-500/50 rounded-full px-6 py-3 flex items-center gap-4 pointer-events-auto animate-slide-up shadow-[0_10px_30px_rgba(0,0,0,1)]">
            <span className="text-sm font-bold text-cyan-300 tracking-wide uppercase">Режим строительства: {placementMode}</span>
            <button onClick={() => setPlacementMode(null)} className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-full text-xs font-bold transition-colors shadow-[0_0_15px_rgba(220,38,38,0.5)]">ОТМЕНА</button>
          </div>
        </div>
      )}
    </div>
  )
}
