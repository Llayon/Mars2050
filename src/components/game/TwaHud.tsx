'use client'

import dynamic from 'next/dynamic'
import { TopResourceBar } from '@/components/game/hud/TopResourceBar'
import { BottomNav } from '@/components/screens/BottomNav'
import type { TabId } from '@/components/screens/BottomNav'
import ColonyScreen from '@/components/screens/ColonyScreen'
import { HudBottomSheet } from '@/components/ui/hud/HudBottomSheet'
import { PlacementActionBar } from '@/components/game/hud/PlacementActionBar'
import type { BuildingTypeKey } from '@/domains/building/building.types'
import type { Colony } from '@/domains/colony/colony.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import type { BuildingRow, BuildingSettingsUpdate } from '@/domains/building/building.types'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'

const BuildCatalogSheet = dynamic(() => import('@/components/game/hud/BuildCatalogSheet').then(mod => mod.BuildCatalogSheet), {
  ssr: false,
  loading: () => null
})

const PopulationScreen = dynamic(() => import('@/components/screens/PopulationScreen').then(mod => mod.PopulationScreen), {
  ssr: false,
  loading: () => null
})

const MapScreen = dynamic(() => import('@/components/screens/MapScreen').then(mod => mod.MapScreen), {
  ssr: false,
  loading: () => null
})

const OperationsScreen = dynamic(() => import('@/components/screens/OperationsScreen').then(mod => mod.OperationsScreen), {
  ssr: false,
  loading: () => null
})

const ProfileScreen = dynamic(() => import('@/components/screens/ProfileScreen').then(mod => mod.ProfileScreen), {
  ssr: false,
  loading: () => null
})

interface TwaHudProps {
  colonyId: string
  colony: Colony | null
  colonyLoading: boolean
  buildings: BuildingRow[]
  resources: ResourceRow[]
  resourcesLoading: boolean
  userEmail?: string
  userId?: string
  tgUser?: { id: number; first_name: string; username?: string } | null
  isTWA?: boolean
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  placementMode: BuildingTypeKey | null
  setPlacementMode: (mode: BuildingTypeKey | null) => void
  onBuild: (type: BuildingTypeKey, x?: number, y?: number) => Promise<void>
  onDemolish: (id: string) => Promise<void>
  onUpdateSettings: (id: string, settings: BuildingSettingsUpdate) => Promise<void>
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
  userId,
  tgUser,
  isTWA,
  activeTab,
  setActiveTab,
  placementMode,
  setPlacementMode,
  onBuild,
  onDemolish,
  onUpdateSettings,
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
    onUpdateSettings,
    onBuild,
    placementMode,
    setPlacementMode,
    isActive: activeTab === 'colony'
  }

  return (
    <div data-testid="twa-hud" className="min-h-[100dvh] bg-black text-white flex flex-col relative overflow-hidden">
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
          userId={userId}
          colonyId={colonyId}
          tgUser={tgUser}
          isTWA={isTWA}
          population={population}
          populationLoading={populationLoading}
          onUpgradePopulation={onUpgradePopulation}
          onLogout={onLogout}
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
