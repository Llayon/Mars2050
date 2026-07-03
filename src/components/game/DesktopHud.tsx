'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'
import type { BattleReplayPayload } from '@/components/game/BattleHistoryPanel'
import ColonyScreen from '@/components/screens/ColonyScreen'
import type { Colony } from '@/domains/colony/colony.types'
import type { BuildingRow, BuildingSettingsUpdate, BuildingTypeKey } from '@/domains/building/building.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'

// New HUD Components
import { GameTopHeader } from '@/components/game/hud/GameTopHeader'
import { CommandDock } from '@/components/game/hud/CommandDock'
import { PlacementActionBar } from '@/components/game/hud/PlacementActionBar'

const GameMapPanel = dynamic(() => import('@/components/game/GameMapPanel').then(mod => mod.GameMapPanel), {
  ssr: false,
  loading: () => <div className="text-gray-300">Загрузка карты...</div>
})

const BattleReplayModal = dynamic(() => import('@/components/game/BattleReplayModal').then(mod => mod.BattleReplayModal), {
  ssr: false,
  loading: () => null
})

const CommandCenterOverlay = dynamic(() => import('@/components/game/command-center/CommandCenterOverlay').then(mod => mod.CommandCenterOverlay), {
  ssr: false,
  loading: () => null
})

const BuildCatalogSheet = dynamic(() => import('@/components/game/hud/BuildCatalogSheet').then(mod => mod.BuildCatalogSheet), {
  ssr: false,
  loading: () => null
})

const GlobalManagementOverlay = dynamic(() => import('@/components/game/global/GlobalManagementOverlay').then(mod => mod.GlobalManagementOverlay), {
  ssr: false,
  loading: () => null
})

const GameAlerts = dynamic(() => import('@/components/game/hud/GameAlerts').then(mod => mod.GameAlerts), {
  ssr: false,
  loading: () => null
})

interface DesktopHudProps {
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
  viewMode: 'colony' | 'map'
  setViewMode: (mode: 'colony' | 'map') => void
  placementMode: BuildingTypeKey | null
  setPlacementMode: (mode: BuildingTypeKey | null) => void
  onBuild: (type: BuildingTypeKey, x?: number, y?: number) => Promise<void>
  onDemolish: (id: string) => Promise<void>
  onUpdateSettings: (id: string, settings: BuildingSettingsUpdate) => Promise<void>
  onPvpResult: (msg: string) => void
  onLogout: () => void
  population: PopulationState | null
  populationLoading?: boolean
  onUpgradePopulation: (fromTier: PopulationTier, count: number) => Promise<void>
}

export function DesktopHud({
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
  viewMode,
  setViewMode,
  placementMode,
  setPlacementMode,
  onBuild,
  onDemolish,
  onUpdateSettings,
  onPvpResult,
  onLogout,
  population,
  populationLoading,
  onUpgradePopulation
}: DesktopHudProps) {
  
  const [buildOpen, setBuildOpen] = useState(false)
  const [armyOpen, setArmyOpen] = useState(false)
  const [intelOpen, setIntelOpen] = useState(false)
  
  // Handlers to auto-close other overlays
  const handleToggleBuild = () => {
    if (!buildOpen) { setArmyOpen(false); setIntelOpen(false); }
    setBuildOpen(!buildOpen)
  }
  const handleToggleArmy = () => {
    if (!armyOpen) { setBuildOpen(false); setIntelOpen(false); }
    setArmyOpen(!armyOpen)
  }
  const handleToggleIntel = () => {
    if (!intelOpen) { setArmyOpen(false); setBuildOpen(false); }
    setIntelOpen(!intelOpen)
  }
  
  const [replayData, setReplayData] = useState<BattleReplayPayload | null>(null)

  const handleReplay = (data: BattleReplayPayload) => {
    setArmyOpen(false)
    setReplayData(data)
  }

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
    setPlacementMode
  }

  return (
    <div data-testid="desktop-hud" className="min-h-[100dvh] bg-black text-white relative overflow-hidden">
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
        <GameTopHeader resources={resources} population={population} colony={colony} />
      )}

      {/* Left Alerts */}
      {!placementMode && viewMode === 'colony' && (
        <GameAlerts colonyId={colonyId} population={population} resources={resources} />
      )}

      {/* Bottom Command Bar */}
      {!placementMode && (
        <CommandDock 
          activeView={viewMode}
          onViewChange={setViewMode}
          onToggleBuild={handleToggleBuild}
          onToggleArmy={handleToggleArmy}
          onToggleIntel={handleToggleIntel}
          armyOpen={armyOpen}
          buildOpen={buildOpen}
          intelOpen={intelOpen}
        />
      )}

      {/* Build Catalog Bottom Sheet (Phase 1) */}
      {buildOpen && !placementMode && viewMode === 'colony' && (
        <BuildCatalogSheet 
          resources={resources}
          onBuild={(type) => {
             setPlacementMode(type)
             setBuildOpen(false)
          }}
          onClose={() => setBuildOpen(false)}
        />
      )}

      {/* Command Center Overlay (Phase 2) */}
      {armyOpen && !placementMode && (
        <CommandCenterOverlay 
          colonyId={colonyId} 
          resources={resources}
          onClose={() => setArmyOpen(false)} 
          onReplay={handleReplay} 
        />
      )}

      {/* Global Management Overlay (Phase 4A) */}
      {intelOpen && !placementMode && viewMode === 'colony' && (
        <GlobalManagementOverlay 
          colonyId={colonyId}
          colony={colony}
          colonyLoading={colonyLoading}
          resources={resources}
          userEmail={userEmail}
          userId={userId}
          tgUser={tgUser}
          isTWA={isTWA}
          onLogout={onLogout}
          onClose={() => setIntelOpen(false)}
        />
      )}

      {/* Placement Mode Float */}
      {placementMode && (
        <PlacementActionBar 
          placementMode={placementMode} 
          resources={resources} 
          onCancel={() => setPlacementMode(null)} 
        />
      )}

      {/* Fullscreen Replay Modal */}
      {replayData && (
        <BattleReplayModal 
          {...replayData} 
          onClose={() => setReplayData(null)} 
        />
      )}
    </div>
  )
}
