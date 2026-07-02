'use client'

import { useState } from 'react'
import { GameMapPanel } from '@/components/game/GameMapPanel'
import { BattleReplayModal } from '@/components/game/BattleReplayModal'
import type { BattleReplayPayload } from '@/components/game/BattleHistoryPanel'
import ColonyScreen from '@/components/screens/ColonyScreen'
import type { Colony } from '@/domains/colony/colony.types'
import type { BuildingRow, BuildingSettingsUpdate, BuildingTypeKey } from '@/domains/building/building.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'

// New HUD Components
import { GameTopHeader } from '@/components/game/hud/GameTopHeader'
import { CommandDock } from '@/components/game/hud/CommandDock'
import { GameAlerts } from '@/components/game/hud/GameAlerts'
import { CommandCenterOverlay } from '@/components/game/command-center/CommandCenterOverlay'
import { BuildCatalogSheet } from '@/components/game/hud/BuildCatalogSheet'
import { GlobalManagementOverlay } from '@/components/game/global/GlobalManagementOverlay'
import { PlacementActionBar } from '@/components/game/hud/PlacementActionBar'

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
  onUpdateSettings: (id: string, settings: BuildingSettingsUpdate) => Promise<void>
  onCreateTestEvent: (id: string, type: string, dur: number) => Promise<boolean>
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
  viewMode,
  setViewMode,
  placementMode,
  setPlacementMode,
  onBuild,
  onDemolish,
  onUpdateSettings,
  onCreateTestEvent,
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
          onCreateTestEvent={onCreateTestEvent}
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
