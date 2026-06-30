import { useState } from 'react'
import { ConstructionTab } from './ConstructionTab'
import { RecruitmentTab } from './RecruitmentTab'
import { EconomyTab } from './EconomyTab'
import type { BuildingRow, BuildingTypeKey } from '@/domains/building/building.types'
import type { ResourceRow } from '@/domains/resource/resource.types'
import type { PopulationState, PopulationTier } from '@/domains/population/population.types'

export interface BaseOperationsOverlayProps {
  colonyId: string
  buildings: BuildingRow[]
  resources: ResourceRow[]
  population: PopulationState | null
  placementMode: BuildingTypeKey | null
  setPlacementMode: (mode: BuildingTypeKey | null) => void
  onBuild: (type: BuildingTypeKey, x?: number, y?: number) => Promise<void>
  onDemolish: (id: string) => Promise<void>
  onUpgradePopulation: (fromTier: PopulationTier, count: number) => Promise<void>
  onClose: () => void
}

type TabType = 'construction' | 'recruitment' | 'economy'

export function BaseOperationsOverlay({
  colonyId,
  buildings,
  resources,
  population,
  placementMode,
  setPlacementMode,
  onBuild,
  onDemolish,
  onUpgradePopulation,
  onClose
}: BaseOperationsOverlayProps) {
  const [activeTab, setActiveTab] = useState<TabType>('construction')

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#070b12] animate-slide-in-right">
      <div className="flex flex-col h-full relative">
        {/* Header / Tabs */}
        <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-cyan-900/50 bg-black/40">
          <div className="flex gap-1 items-center">
            <h2 className="text-xl font-bold text-white tracking-widest uppercase mr-8 flex items-center gap-3">
              <span className="w-3 h-3 bg-cyan-500 rounded-sm shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
              Infrastructure
            </h2>
            
            <TabButton 
              active={activeTab === 'construction'} 
              onClick={() => setActiveTab('construction')}
            >
              Construction
            </TabButton>
            <TabButton 
              active={activeTab === 'recruitment'} 
              onClick={() => setActiveTab('recruitment')}
            >
              Recruitment
            </TabButton>
            <TabButton 
              active={activeTab === 'economy'} 
              onClick={() => setActiveTab('economy')}
            >
              Economy
            </TabButton>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white px-3 py-1 font-mono uppercase tracking-widest border border-transparent hover:border-red-500/50 hover:bg-red-500/10 transition-all rounded"
          >
            [ X ] CLOSE
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'construction' && (
            <ConstructionTab 
              buildings={buildings} 
              resources={resources} 
              onBuild={onBuild} 
              onClose={onClose} 
            />
          )}
          {activeTab === 'recruitment' && (
            <RecruitmentTab 
              colonyId={colonyId} 
              resources={resources} 
            />
          )}
          {activeTab === 'economy' && (
            <EconomyTab 
              resources={resources} 
              population={population} 
              buildings={buildings}
              onUpgradePopulation={onUpgradePopulation}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function TabButton({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  if (active) {
    return (
      <button className="px-6 py-2 rounded font-bold text-xs tracking-widest uppercase transition-all bg-cyan-900/40 border border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.15)] relative">
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,1)]" />
        {children}
      </button>
    )
  }
  
  return (
    <button 
      onClick={onClick}
      className="px-6 py-2 rounded font-bold text-xs tracking-widest uppercase transition-all bg-black/60 border border-cyan-900/30 text-gray-400 hover:text-cyan-300 hover:bg-black/80 hover:border-cyan-500/50"
    >
      {children}
    </button>
  )
}
