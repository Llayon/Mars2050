'use client'

import { TopResourceBar } from '@/components/game/hud/TopResourceBar'
import { BottomNav } from '@/components/screens/BottomNav'
import type { TabId } from '@/components/screens/BottomNav'
import ColonyScreen from '@/components/screens/ColonyScreen'
import { BuildingsScreen } from '@/components/screens/BuildingsScreen'
import { MapScreen } from '@/components/screens/MapScreen'
import { OperationsScreen } from '@/components/screens/OperationsScreen'
import { ProfileScreen } from '@/components/screens/ProfileScreen'
import { PopulationScreen } from '@/components/screens/PopulationScreen'
import { HudBottomSheet } from '@/components/ui/hud/HudBottomSheet'
import { BuildCatalogSheet } from '@/components/game/hud/BuildCatalogSheet'
import { PlacementActionBar } from '@/components/game/hud/PlacementActionBar'
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
      
      {!placementMode && (
        <TopResourceBar resources={resources} population={population} colony={colony} isMobile={true} />
      )}
      
      {activeTab === 'buildings' && !placementMode && (
        <BuildCatalogSheet 
          resources={resources}
          isMobile={true}
          onBuild={async (type) => { setPlacementMode(type); setActiveTab('colony'); }}
          onClose={() => setActiveTab('colony')}
        />
      )}

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
        <PlacementActionBar 
          placementMode={placementMode} 
          resources={resources} 
          onCancel={() => setPlacementMode(null)} 
        />
      )}

      {!placementMode && (
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      )}
    </div>
  )
}
