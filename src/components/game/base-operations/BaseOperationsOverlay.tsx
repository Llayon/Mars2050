import { useState } from 'react'
import { ConstructionTab } from './ConstructionTab'
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

type TabType = 'construction' | 'economy'

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
    <>
      {/* Soft Backdrop */}
      <div 
        className="absolute inset-0 z-20 bg-black/30 backdrop-blur-[2px] transition-opacity" 
        onClick={onClose} 
      />

      {/* Side Panel */}
      <div className="absolute top-[60px] bottom-[60px] right-0 w-[460px] z-30 flex flex-col bg-gray-900/95 backdrop-blur-xl border-l border-t border-b border-gray-700/80 rounded-l-3xl shadow-[-10px_0_40px_rgba(0,0,0,0.9)] animate-slide-in-right overflow-hidden">
        <div className="flex flex-col h-full relative">
          {/* Header / Tabs */}
          <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-gray-700/50 bg-black/20">
            <div className="flex flex-col gap-3 w-full">
              <div className="flex justify-between items-center w-full">
                <h2 className="text-xl font-bold text-white tracking-widest uppercase flex items-center gap-3">
                  <span className="w-3 h-3 bg-cyan-500 rounded-sm shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                  Infrastructure
                </h2>
                <button 
                  onClick={onClose}
                  className="text-gray-400 hover:text-white flex items-center justify-center w-8 h-8 font-mono border border-transparent hover:border-red-500/50 hover:bg-red-500/10 transition-all rounded"
                  title="Close"
                >
                  <span className="text-lg leading-none">&times;</span>
                </button>
              </div>
              
              <div className="flex gap-2">
                <TabButton 
                  active={activeTab === 'construction'} 
                  onClick={() => setActiveTab('construction')}
                >
                  Construction
                </TabButton>
                <TabButton 
                  active={activeTab === 'economy'} 
                  onClick={() => setActiveTab('economy')}
                >
                  Economy
                </TabButton>
              </div>
            </div>
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
    </>
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
