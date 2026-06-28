'use client'

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
import type { PopulationState } from '@/domains/population/population.types'
import { PopulationPanel } from '@/components/game/PopulationPanel'

interface DesktopHudProps {
  colonyId: string
  colony: Colony | null
  colonyLoading: boolean
  buildings: BuildingRow[]
  resources: ResourceRow[]
  resourcesLoading: boolean
  userEmail?: string
  viewMode: 'classic' | 'isometric'
  setViewMode: (mode: 'classic' | 'isometric') => void
  placementMode: BuildingTypeKey | null
  setPlacementMode: (mode: BuildingTypeKey | null) => void
  onBuild: (type: BuildingTypeKey, x?: number, y?: number) => Promise<void>
  onDemolish: (id: string) => Promise<void>
  onCreateTestEvent: (id: string, type: string, dur: number) => Promise<boolean>
  onPvpResult: (msg: string) => void
  onLogout: () => void
  population: PopulationState | null
  populationLoading?: boolean
  onUpgradePopulation: (fromTier: string, count: number) => void
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
      <div className="absolute inset-0 z-0">
        {viewMode === 'isometric' ? (
          <ColonyScreen {...colonyScreenProps} />
        ) : (
          <div className="w-full h-full bg-mars-surface p-4 pt-24 overflow-y-auto">
             <GameMapPanel colonyId={colonyId} />
          </div>
        )}
      </div>

      {!placementMode && (
        <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none p-4 flex justify-between items-start">
          <div className="w-80 pointer-events-auto space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar pr-2">
            <ColonyPanel colony={colony} loading={colonyLoading} />
            <ResourcePanel resources={resources} loading={resourcesLoading} />
            <PopulationPanel population={population} onUpgrade={onUpgradePopulation} loading={populationLoading} />
          </div>
          <div className="flex flex-col items-end gap-2 pointer-events-auto">
            <div className="hud-panel rounded-lg px-4 py-2 flex items-center gap-4">
              <span className="text-sm font-bold text-gray-200">{colony?.name || 'Колония'}</span>
              <span className="text-xs text-mars-gold">Ур. {colony?.level || 1}</span>
              <button onClick={onLogout} className="text-[10px] uppercase text-red-400 hover:text-red-300 ml-2">Выход</button>
            </div>
            <div className="hud-panel rounded-lg p-1 flex gap-1 w-48">
               <button onClick={() => setViewMode('isometric')} className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all border ${viewMode === 'isometric' ? 'bg-mars-orange border-mars-orange text-white shadow-[0_0_10px_rgba(255,107,0,0.4)]' : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5'}`}>БАЗА</button>
               <button onClick={() => setViewMode('classic')} className={`flex-1 py-1.5 rounded text-[10px] font-bold transition-all border ${viewMode === 'classic' ? 'bg-mars-orange border-mars-orange text-white shadow-[0_0_10px_rgba(255,107,0,0.4)]' : 'bg-transparent border-transparent text-gray-400 hover:bg-white/5'}`}>КАРТА</button>
            </div>
          </div>
        </div>
      )}

      {!placementMode && (
        <div className="absolute top-48 left-4 bottom-4 w-80 z-10 pointer-events-none overflow-y-auto">
          <div className="pointer-events-auto space-y-4 pb-4">
            <EventsPanel colonyId={colonyId} onCreateTest={onCreateTestEvent} />
            <PvpPanel colonyId={colonyId} onResult={onPvpResult} />
            <ArmyPanel colonyId={colonyId} resources={resources} />
          </div>
        </div>
      )}

      {!placementMode && (
        <div className="absolute top-24 right-4 bottom-4 w-96 z-10 pointer-events-none overflow-y-auto">
          <div className="pointer-events-auto space-y-4 pb-4">
            <BuildingsPanel buildings={buildings} resources={resources} onBuild={onBuild} onDemolish={onDemolish} />
            <LeaderboardPanel />
          </div>
        </div>
      )}

      {placementMode && (
        <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center pointer-events-none">
          <div className="hud-panel rounded-full px-6 py-3 flex items-center gap-4 pointer-events-auto animate-slide-up shadow-2xl shadow-black border-cyan-500/50">
            <span className="text-sm font-bold text-cyan-300 tracking-wide uppercase">Режим строительства: {placementMode}</span>
            <button onClick={() => setPlacementMode(null)} className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-full text-xs font-bold transition-colors shadow-[0_0_15px_rgba(220,38,38,0.5)]">ОТМЕНА</button>
          </div>
        </div>
      )}
    </div>
  )
}
