'use client'

import { BottomNav } from '@/components/screens/BottomNav'
import type { TabId } from '@/components/screens/BottomNav'
import ColonyScreen from '@/components/screens/ColonyScreen'
import { BuildingsScreen } from '@/components/screens/BuildingsScreen'
import { MapScreen } from '@/components/screens/MapScreen'
import { OperationsScreen } from '@/components/screens/OperationsScreen'
import { ProfileScreen } from '@/components/screens/ProfileScreen'
import { PopulationScreen } from '@/components/screens/PopulationScreen'
import { HudBottomSheet } from '@/components/ui/hud/HudBottomSheet'
import type { BuildingTypeKey } from '@/domains/building/building.types'
import type { Colony } from '@/domains/colony/colony.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import type { BuildingRow } from '@/domains/building/building.types'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'

interface TwaHudProps {
  colonyId: string
  colony: Colony | null
  colonyLoading: boolean
  buildings: BuildingRow[]
  resources: ResourceRow[]
  resourcesLoading: boolean
  userEmail?: string
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  placementMode: BuildingTypeKey | null
  setPlacementMode: (mode: BuildingTypeKey | null) => void
  onBuild: (type: BuildingTypeKey, x?: number, y?: number) => Promise<void>
  onDemolish: (id: string) => Promise<void>
  onLogout: () => void
  population: PopulationState | null
  populationLoading?: boolean
  onUpgradePopulation: (fromTier: PopulationTier, count: number) => void
}

export function TwaHud({
  colonyId,
  colony,
  colonyLoading,
  buildings,
  resources,
  resourcesLoading,
  userEmail,
  activeTab,
  setActiveTab,
  placementMode,
  setPlacementMode,
  onBuild,
  onDemolish,
  onLogout,
  population,
  populationLoading,
  onUpgradePopulation
}: TwaHudProps) {
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
    <div className="min-h-[100dvh] bg-black text-white flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <ColonyScreen {...colonyScreenProps} />
      </div>
      
      <HudBottomSheet open={activeTab === 'buildings'} onClose={() => setActiveTab('colony')}>
        <BuildingsScreen buildings={buildings} colonyId={colonyId} resources={resources} resourcesLoading={resourcesLoading} onBuild={async (type) => { setPlacementMode(type); setActiveTab('colony'); }} onDemolish={onDemolish} population={population} />
      </HudBottomSheet>

      <HudBottomSheet open={activeTab === 'population'} onClose={() => setActiveTab('colony')}>
        <PopulationScreen population={population} buildings={buildings} resources={resources} onUpgrade={async (t, c) => onUpgradePopulation(t, c)} />
      </HudBottomSheet>

      <HudBottomSheet open={activeTab === 'map'} onClose={() => setActiveTab('colony')}>
        <MapScreen colonyId={colonyId} resources={resources} resourcesLoading={resourcesLoading} />
      </HudBottomSheet>

      <HudBottomSheet open={activeTab === 'operations'} onClose={() => setActiveTab('colony')}>
        <OperationsScreen colonyId={colonyId} resources={resources} />
      </HudBottomSheet>

      <HudBottomSheet open={activeTab === 'profile'} onClose={() => setActiveTab('colony')}>
        <ProfileScreen 
          colony={colony}
          colonyLoading={colonyLoading}
          userEmail={userEmail}
          population={population}
          populationLoading={populationLoading}
          onUpgradePopulation={onUpgradePopulation}
        />
      </HudBottomSheet>

      {placementMode && (
        <div className="absolute bottom-8 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div className="hud-panel rounded-full px-5 py-2.5 flex items-center gap-3 pointer-events-auto animate-slide-up shadow-2xl shadow-black">
            <span className="text-xs font-bold text-cyan-300 uppercase">Стройка: {placementMode}</span>
            <button onClick={() => setPlacementMode(null)} className="bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-full text-[10px] font-bold transition-colors">ОТМЕНА</button>
          </div>
        </div>
      )}

      {!placementMode && (
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  )
}
