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
import { BattleReplayModal } from '@/components/game/BattleReplayModal'
import type { BattleReplayPayload } from '@/components/game/BattleHistoryPanel'
import type { UnitRow, BattleTick, SimUnit, Obstacle } from '@/domains/combat/combat.types'
import ColonyScreen from '@/components/screens/ColonyScreen'
import type { Colony } from '@/domains/colony/colony.types'
import type { BuildingRow, BuildingTypeKey } from '@/domains/building/building.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'
import { PopulationSummary } from '@/components/game/PopulationSummary'

// New HUD Components
import { TopResourceBar } from '@/components/game/hud/TopResourceBar'
import { ActionBottomBar } from '@/components/game/hud/ActionBottomBar'
import { GameAlerts } from '@/components/game/hud/GameAlerts'
import { LegacyPanelsDrawer } from '@/components/game/hud/LegacyPanelsDrawer'
import { CommandCenterOverlay } from '@/components/game/command-center/CommandCenterOverlay'
import { BaseOperationsOverlay } from '@/components/game/base-operations/BaseOperationsOverlay'
import { GlobalManagementOverlay } from '@/components/game/global/GlobalManagementOverlay'

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
  const [intelOpen, setIntelOpen] = useState(false)
  
  // Handlers to auto-close other overlays
  const handleToggleBuild = () => {
    if (!buildOpen) { setArmyOpen(false); setIntelOpen(false); setLegacyOpen(false); }
    setBuildOpen(!buildOpen)
  }
  const handleToggleArmy = () => {
    if (!armyOpen) { setBuildOpen(false); setIntelOpen(false); setLegacyOpen(false); }
    setArmyOpen(!armyOpen)
  }
  const handleToggleIntel = () => {
    if (!intelOpen) { setArmyOpen(false); setBuildOpen(false); setLegacyOpen(false); }
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
          onToggleBuild={handleToggleBuild}
          onToggleArmy={handleToggleArmy}
          onToggleManagement={() => setLegacyOpen(!legacyOpen)}
          onToggleIntel={handleToggleIntel}
        />
      )}

      {/* Base Operations Overlay (Phase 3) */}
      {buildOpen && !placementMode && viewMode === 'colony' && (
        <BaseOperationsOverlay 
          colonyId={colonyId}
          buildings={buildings}
          resources={resources}
          population={population}
          placementMode={placementMode}
          setPlacementMode={setPlacementMode}
          onBuild={onBuild}
          onDemolish={onDemolish}
          onUpgradePopulation={onUpgradePopulation}
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
